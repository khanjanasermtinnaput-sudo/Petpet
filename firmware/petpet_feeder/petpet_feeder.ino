// Petpet smart feeder — NodeMCU ESP-12E (ESP8266)
//
// Talks straight to Supabase PostgREST. There is no application server in the
// path, so the feeder keeps working when the website is down.
//
// Authentication is two-layer and easy to misread: the anon key in the
// headers is public (the browser ships it too) and proves nothing. The real
// credential is DEVICE_SECRET, passed as an argument to SECURITY DEFINER
// functions that verify its sha256 against the devices table. That table is
// deny-all, and this device has no direct table access of any kind.
//
// Libraries: ESP8266WiFi, WiFiClientSecure, ESP8266HTTPClient, ArduinoJson,
// Servo. All ship with the ESP8266 core except ArduinoJson (v7).
//
// See docs/HARDWARE.md for wiring, provisioning and troubleshooting.

#include <ESP8266WiFi.h>
#include <WiFiClientSecure.h>
#include <ESP8266HTTPClient.h>
#include <ArduinoJson.h>
#include <Servo.h>

#include "config.h"

// --------------------------------------------------------------------------
// Scheduling
//
// Every deadline is an absolute millis() stamp compared by subtraction, so
// the 49.7-day rollover is a non-event: (int32_t)(now - deadline) stays
// correct across the wrap. Never compare millis() with < directly.
// --------------------------------------------------------------------------
static inline bool due(uint32_t deadline) {
  return (int32_t)(millis() - deadline) >= 0;
}

enum State {
  ST_WIFI_CONNECT,
  ST_NET_INIT,
  ST_IDLE,
  ST_DISPENSE_OPEN,
  ST_DISPENSE_WAIT,
  ST_DISPENSE_CLOSE,
  ST_WEIGH_AFTER,
  ST_REPORT,
};

static State state = ST_WIFI_CONNECT;

static BearSSL::WiFiClientSecure tlsClient;
// Session resumption. A full BearSSL handshake is 2-6 seconds of RSA-2048
// work and a large heap spike; resuming one costs ~200 ms. At 1 Hz we must
// never pay the full price more than once.
static BearSSL::Session tlsSession;
#if PIN_ROOT_CA
static BearSSL::X509List trustAnchors(ROOT_CA_PEM);
#endif

static HTTPClient http;
static Servo feedServo;

// In-flight command.
static char cmdId[40] = {0};
static float cmdTargetG = 0.0f;
static float trayBeforeG = 0.0f;
static float trayAfterG = 0.0f;
static bool haveWeights = false;

// Deadlines.
static uint32_t nextPollAt = 0;
static uint32_t nextReadingAt = 0;
static uint32_t dispenseEndsAt = 0;
static uint32_t weighAt = 0;
static uint32_t nextReportAt = 0;
static uint8_t reportAttempts = 0;
static uint32_t wifiRetryAt = 0;
static uint32_t wifiBackoffMs = 1000;
static uint32_t wifiDownSince = 0;
static uint32_t nextHeapLogAt = 0;

// Deferred consumption check: SETTLE_DELAY_MS after a good feed, weigh the
// tray again and report what the pet actually ate.
static bool settlePending = false;
static char settleCmdId[40] = {0};
static uint32_t settleAt = 0;

// --------------------------------------------------------------------------
// Load cell (HX711, bit-banged — no library)
// --------------------------------------------------------------------------
static float lastTrayG = 0.0f;

#if HAS_LOAD_CELL
static bool scaleReady() {
  return digitalRead(HX711_DOUT_PIN) == LOW;
}

static long scaleReadRaw() {
  long value = 0;

  // ~50 us with interrupts off. The HX711 protocol has no framing, so a WiFi
  // interrupt landing mid-read corrupts the sample silently.
  noInterrupts();
  for (uint8_t i = 0; i < 24; i++) {
    digitalWrite(HX711_SCK_PIN, HIGH);
    delayMicroseconds(1);
    value = (value << 1) | (digitalRead(HX711_DOUT_PIN) ? 1 : 0);
    digitalWrite(HX711_SCK_PIN, LOW);
    delayMicroseconds(1);
  }
  // 25th pulse: select channel A at gain 128 for the next conversion.
  digitalWrite(HX711_SCK_PIN, HIGH);
  delayMicroseconds(1);
  digitalWrite(HX711_SCK_PIN, LOW);
  interrupts();

  // Sign-extend the 24-bit two's-complement result.
  if (value & 0x800000L) value |= ~0xFFFFFFL;
  return value;
}

// Opportunistic: sample only when the chip says a conversion is ready, so
// nothing ever blocks the ~100 ms a 10 SPS conversion takes.
static void sampleScale() {
  if (!scaleReady()) return;
  long raw = scaleReadRaw();
  lastTrayG = (float)(raw - SCALE_TARE_RAW) / SCALE_COUNTS_PER_G;
  if (lastTrayG < 0.0f) lastTrayG = 0.0f;
}
#else
static void sampleScale() {}
#endif

static float trayWeightG() {
  return lastTrayG;
}

// --------------------------------------------------------------------------
// HTTP
// --------------------------------------------------------------------------

// Returns the HTTP status code, or a negative HTTPClient error. On 200 the
// response body is parsed into `out` when `out` is non-null.
static int postRpc(const char* fn, const char* body, JsonDocument* out) {
  char url[160];
  snprintf(url, sizeof(url), "https://%s/rest/v1/rpc/%s", SUPABASE_HOST, fn);

  if (!http.begin(tlsClient, url)) {
    Serial.println(F("[http] begin failed"));
    return -1000;
  }

  http.addHeader(F("apikey"), F(SUPABASE_ANON_KEY));
  http.addHeader(F("Authorization"), F("Bearer " SUPABASE_ANON_KEY));
  http.addHeader(F("Content-Type"), F("application/json"));
  http.addHeader(F("Accept"), F("application/json"));

  int code = http.POST((uint8_t*)body, strlen(body));

  if (code == HTTP_CODE_OK && out != nullptr) {
    // Parsed straight off the socket. Materialising a String first would
    // fragment a heap that only has ~40 KB free after the WiFi stack.
    DeserializationError err = deserializeJson(*out, http.getStream());
    if (err) {
      Serial.printf("[http] %s: bad json: %s\n", fn, err.c_str());
      http.end();
      return -1001;
    }
  } else if (code != HTTP_CODE_OK) {
    // 403 means the secret is wrong or the device_id is not registered; 404
    // with a PGRST202 body means the schema cache is stale. Both are
    // configuration errors, not transient, so they are logged loudly.
    Serial.printf("[http] %s -> %d %s\n", fn, code,
                  code > 0 ? http.getString().c_str() : http.errorToString(code).c_str());
  }

  http.end();
  return code;
}

// --------------------------------------------------------------------------
// Device RPCs
// --------------------------------------------------------------------------

static void pollForCommand() {
  char body[256];
  snprintf(body, sizeof(body),
           "{\"p_device_id\":\"%s\",\"p_secret\":\"%s\"}",
           DEVICE_ID, DEVICE_SECRET);

  JsonDocument doc;
  int code = postRpc("device_poll_command", body, &doc);
  if (code != HTTP_CODE_OK) return;

  // An idle poll returns SQL NULL, which PostgREST renders as a 4-byte
  // `null` body. This is the steady state, so it is deliberately the
  // cheapest path in the whole firmware.
  if (doc.isNull()) return;

  const char* id = doc["id"];
  if (id == nullptr) return;

  strncpy(cmdId, id, sizeof(cmdId) - 1);
  cmdId[sizeof(cmdId) - 1] = '\0';
  cmdTargetG = doc["target_g"] | 0.0f;

  Serial.printf("[cmd] %s target=%.1fg\n", cmdId, cmdTargetG);
  state = ST_DISPENSE_OPEN;
}

static void reportResult(bool success, const char* errorCode) {
  char body[384];

  if (success && haveWeights) {
    float dispensed = trayAfterG - trayBeforeG;
    if (dispensed < 0.0f) dispensed = 0.0f;
    snprintf(body, sizeof(body),
             "{\"p_device_id\":\"%s\",\"p_secret\":\"%s\",\"p_command_id\":\"%s\","
             "\"p_success\":true,\"p_dispensed_g\":%.2f,\"p_tray_weight_g\":%.2f}",
             DEVICE_ID, DEVICE_SECRET, cmdId, dispensed, trayAfterG);
  } else if (success) {
    // No load cell: report success without a weight. device_report_result()
    // falls back to the commanded amount, and the dashboard says so.
    snprintf(body, sizeof(body),
             "{\"p_device_id\":\"%s\",\"p_secret\":\"%s\",\"p_command_id\":\"%s\","
             "\"p_success\":true}",
             DEVICE_ID, DEVICE_SECRET, cmdId);
  } else {
    snprintf(body, sizeof(body),
             "{\"p_device_id\":\"%s\",\"p_secret\":\"%s\",\"p_command_id\":\"%s\","
             "\"p_success\":false,\"p_error\":\"%s\"}",
             DEVICE_ID, DEVICE_SECRET, cmdId, errorCode);
  }

  int code = postRpc("device_report_result", body, nullptr);

  if (code == HTTP_CODE_OK) {
    Serial.printf("[cmd] %s reported\n", cmdId);

#if HAS_LOAD_CELL
    if (success && haveWeights) {
      strncpy(settleCmdId, cmdId, sizeof(settleCmdId) - 1);
      settleCmdId[sizeof(settleCmdId) - 1] = '\0';
      settleAt = millis() + SETTLE_DELAY_MS;
      settlePending = true;
    }
#endif

    cmdId[0] = '\0';
    reportAttempts = 0;
    state = ST_IDLE;
    return;
  }

  // Retry — device_report_result() is idempotent against its `running`
  // guard, so a report that actually landed before the connection dropped
  // cannot produce a second feed_event.
  if (++reportAttempts >= 3) {
    Serial.println(F("[cmd] giving up on report; server will time it out"));
    cmdId[0] = '\0';
    reportAttempts = 0;
    state = ST_IDLE;
    return;
  }
  nextReportAt = millis() + (uint32_t)reportAttempts * 2000UL;
}

#if HAS_LOAD_CELL
static void reportConsumption() {
  char body[320];
  snprintf(body, sizeof(body),
           "{\"p_device_id\":\"%s\",\"p_secret\":\"%s\",\"p_command_id\":\"%s\","
           "\"p_tray_weight_g\":%.2f}",
           DEVICE_ID, DEVICE_SECRET, settleCmdId, trayWeightG());

  // One shot. If it fails the meal simply keeps actual_eaten_g = 0; there is
  // no reconciliation job.
  postRpc("device_report_consumption", body, nullptr);
  settlePending = false;
  settleCmdId[0] = '\0';
}

static void reportReading() {
  char body[384];
  snprintf(body, sizeof(body),
           "{\"p_device_id\":\"%s\",\"p_secret\":\"%s\","
           "\"p_tray_weight_g\":%.2f,\"p_tank_weight_g\":%.2f,"
           "\"p_wifi_rssi\":%d,\"p_firmware_version\":\"%s\"}",
           DEVICE_ID, DEVICE_SECRET, trayWeightG(), 0.0f,
           WiFi.RSSI(), FIRMWARE_VERSION);

  postRpc("device_report_reading", body, nullptr);
}
#endif

// --------------------------------------------------------------------------
// WiFi
// --------------------------------------------------------------------------
static void startWifi() {
  WiFi.mode(WIFI_STA);
  // Don't rewrite flash on every boot.
  WiFi.persistent(false);
  WiFi.setAutoReconnect(true);
  // Costs ~70 mA but removes multi-second latency spikes from modem sleep.
  // This is a mains-powered appliance, so trade power for responsiveness.
  WiFi.setSleepMode(WIFI_NONE_SLEEP);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

// --------------------------------------------------------------------------
// setup / loop
// --------------------------------------------------------------------------
void setup() {
  Serial.begin(115200);
  Serial.println();
  Serial.println(F("[boot] petpet feeder " FIRMWARE_VERSION));

  // Park the gate closed before anything else can take time.
  feedServo.attach(SERVO_PIN);
  feedServo.write(SERVO_CLOSED_ANGLE);
  delay(300);
  feedServo.detach();

#if HAS_LOAD_CELL
  pinMode(HX711_SCK_PIN, OUTPUT);
  pinMode(HX711_DOUT_PIN, INPUT);
  digitalWrite(HX711_SCK_PIN, LOW);
#endif

  tlsClient.setSession(&tlsSession);
  startWifi();
  state = ST_WIFI_CONNECT;
}

static void netInit() {
#if PIN_ROOT_CA
  // BearSSL rejects a certificate as not-yet-valid against a 1970 clock, and
  // the symptom is an unexplained handshake failure. Only needed here — no
  // business logic depends on the device knowing the time.
  configTime(7 * 3600, 0, "pool.ntp.org", "time.google.com");
  uint32_t waitUntil = millis() + 15000;
  while (time(nullptr) < 8 * 3600 * 2 && !due(waitUntil)) {
    delay(200);
    yield();
  }
  tlsClient.setTrustAnchors(&trustAnchors);
#else
  // See config.example.h for the threat model this accepts.
  tlsClient.setInsecure();
#endif

  // Measured, not assumed: whether the CDN in front of Supabase honours RFC
  // 6066 max-fragment-length is a property of their edge, not ours, and
  // guessing wrong fails at handshake time rather than degrading.
  bool mfln = BearSSL::WiFiClientSecure::probeMaxFragmentLength(SUPABASE_HOST, 443, 1024);
  Serial.printf("[tls] mfln=%d heap=%u\n", mfln ? 1 : 0, ESP.getFreeHeap());
  tlsClient.setBufferSizes(mfln ? 1024 : 16384, 512);

  // Keep-alive: at 1 Hz the socket never idles out, so a poll is a small
  // request over an already-open TLS session rather than a new handshake.
  http.setReuse(true);
  http.setTimeout(8000);

  nextPollAt = millis();
  nextReadingAt = millis();
  state = ST_IDLE;
}

void loop() {
  // --- connectivity -------------------------------------------------------
  if (WiFi.status() != WL_CONNECTED) {
    if (state != ST_WIFI_CONNECT) {
      Serial.println(F("[wifi] lost"));
      // Force a fresh socket; session resumption makes reconnecting cheap.
      tlsClient.stop();
      wifiDownSince = millis();
      wifiBackoffMs = 1000;
      wifiRetryAt = millis();
      state = ST_WIFI_CONNECT;
    }

    if (due(wifiRetryAt)) {
      Serial.printf("[wifi] connecting (backoff %lu ms)\n", (unsigned long)wifiBackoffMs);
      WiFi.reconnect();
      wifiRetryAt = millis() + wifiBackoffMs;
      wifiBackoffMs = wifiBackoffMs < 30000 ? wifiBackoffMs * 2 : 30000;
    }

    // Five minutes with no network means something is wedged that a reboot
    // usually clears. Any command in flight is already safe: it sits in
    // `running` and the server's expire_stale_commands() fails it after 120s.
    if (wifiDownSince != 0 && due(wifiDownSince + 300000UL)) {
      Serial.println(F("[wifi] down 5 min, restarting"));
      ESP.restart();
    }

    yield();
    return;
  }

  if (state == ST_WIFI_CONNECT) {
    Serial.print(F("[wifi] connected "));
    Serial.println(WiFi.localIP());
    wifiDownSince = 0;
    wifiBackoffMs = 1000;
    state = ST_NET_INIT;
  }

  if (state == ST_NET_INIT) {
    netInit();
    return;
  }

  sampleScale();

  if (due(nextHeapLogAt)) {
    Serial.printf("[heap] %u rssi=%d\n", ESP.getFreeHeap(), WiFi.RSSI());
    nextHeapLogAt = millis() + 30000UL;
  }

  // --- state machine ------------------------------------------------------
  switch (state) {
    case ST_IDLE: {
      // A low heap makes a TLS write fail in ways that look like a network
      // fault. Skip the cycle rather than thrash.
      if (ESP.getFreeHeap() < 20000) {
        yield();
        return;
      }

#if HAS_LOAD_CELL
      if (settlePending && due(settleAt)) {
        reportConsumption();
        return;
      }
      if (due(nextReadingAt)) {
        reportReading();
        nextReadingAt = millis() + READING_INTERVAL_MS;
        return;
      }
#endif

      if (due(nextPollAt)) {
        nextPollAt = millis() + POLL_INTERVAL_MS;
        pollForCommand();
      }
      break;
    }

    case ST_DISPENSE_OPEN: {
      trayBeforeG = trayWeightG();

      uint32_t ms = (uint32_t)((cmdTargetG / GRAMS_PER_SECOND) * 1000.0f);
      if (ms > MAX_DISPENSE_MS) ms = MAX_DISPENSE_MS;

      if (cmdTargetG <= 0.0f || ms == 0) {
        // Nothing to do — the tray already meets the target. Report success
        // so the command doesn't sit until it times out.
        haveWeights = false;
        state = ST_REPORT;
        nextReportAt = millis();
        break;
      }

      Serial.printf("[servo] open %lu ms\n", (unsigned long)ms);
      feedServo.attach(SERVO_PIN);
      feedServo.write(SERVO_OPEN_ANGLE);
      dispenseEndsAt = millis() + ms;
      state = ST_DISPENSE_WAIT;
      break;
    }

    case ST_DISPENSE_WAIT: {
      // No network I/O while the gate is open. The servo pulse train comes
      // from a timer ISR, and BearSSL's crypto plus the WiFi stack hold
      // interrupts off long enough to visibly glitch it.
      if (due(dispenseEndsAt)) state = ST_DISPENSE_CLOSE;
      yield();
      break;
    }

    case ST_DISPENSE_CLOSE: {
      feedServo.write(SERVO_CLOSED_ANGLE);
      delay(300);  // let the gate physically reach the stop before detaching
      feedServo.detach();
      Serial.println(F("[servo] closed"));

      // Give the load cell time to stop ringing before believing it.
      weighAt = millis() + 800;
      state = ST_WEIGH_AFTER;
      break;
    }

    case ST_WEIGH_AFTER: {
      if (!due(weighAt)) {
        yield();
        break;
      }
#if HAS_LOAD_CELL
      trayAfterG = trayWeightG();
      haveWeights = true;
#else
      haveWeights = false;
#endif
      nextReportAt = millis();
      reportAttempts = 0;
      state = ST_REPORT;
      break;
    }

    case ST_REPORT: {
      if (due(nextReportAt)) reportResult(true, nullptr);
      break;
    }

    default:
      break;
  }

  yield();
}
