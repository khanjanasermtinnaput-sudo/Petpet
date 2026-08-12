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
  ST_DISPENSE_STOP_OPEN,
  ST_DISPENSE_WAIT,
  ST_DISPENSE_CLOSE,
  ST_DISPENSE_STOP_CLOSE,
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

// UV is fail-closed: it starts off and turns off on any unknown lid state.
static bool uvOn = false;
static uint32_t nextLidSampleAt = 0;

#if HAS_ULTRASONIC
static float lidDistanceSamples[3] = {0.0f, 0.0f, 0.0f};
static uint8_t lidSampleCount = 0;
static uint8_t lidSampleIndex = 0;
static uint8_t lidClosedConfirmations = 0;
#endif

// In-flight command.
static char cmdId[40] = {0};
static float cmdTargetG = 0.0f;
static float trayBeforeG = 0.0f;
static float trayAfterG = 0.0f;
static bool haveWeights = false;
#if HAS_LOAD_CELL
static float dispenseCloseAtG = 0.0f;
#endif
// Set when a dispense was cut short by a WiFi drop. cmdId is deliberately kept
// (not cleared) in that case so ST_REPORT can tell the server the true
// outcome once reconnected, instead of leaving the command to rot until the
// server's 120s timeout — which would also block a fresh Feed Now press for
// that whole window, since only one active command per device is allowed.
static bool cmdAborted = false;

// Deadlines.
static uint32_t nextPollAt = 0;
static uint32_t nextReadingAt = 0;
static uint32_t servoMotionEndsAt = 0;
static uint32_t dispenseEndsAt = 0;
static uint32_t weighAt = 0;
static uint32_t nextReportAt = 0;
static uint8_t reportAttempts = 0;
static uint32_t wifiRetryAt = 0;
// Let the SDK's auto-reconnect complete before falling back to a fresh
// WiFi.begin(). Calling reconnect() while already disconnected can be a no-op
// on ESP8266, while repeatedly calling begin() interrupts DHCP in progress.
static uint32_t wifiBackoffMs = 15000;
static uint32_t wifiDownSince = 0;
static uint32_t nextHeapLogAt = 0;
static WiFiEventHandler wifiDisconnectHandler;

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
static long lastScaleRaw = 0;
static uint32_t nextScaleLogAt = 0;

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
  lastScaleRaw = raw;
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
// Lid sensor and UV safety control
// --------------------------------------------------------------------------

static uint8_t uvOutputLevel(bool enabled) {
  return enabled
      ? (UV_ACTIVE_HIGH ? HIGH : LOW)
      : (UV_ACTIVE_HIGH ? LOW : HIGH);
}

static void setUv(bool enabled, const char* reason) {
  digitalWrite(UV_PIN, uvOutputLevel(enabled));
  if (uvOn != enabled) {
    Serial.printf("[uv] %s (%s)\n", enabled ? "on" : "off", reason);
  }
  uvOn = enabled;
}

static void initializeUv() {
  pinMode(UV_PIN, OUTPUT);
  digitalWrite(UV_PIN, uvOutputLevel(false));
  uvOn = false;
}

#if HAS_ULTRASONIC
static bool readLidDistanceCm(float* distanceCm) {
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(ULTRASONIC_TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);

  const unsigned long echoUs = pulseIn(
      ULTRASONIC_ECHO_PIN, HIGH, ULTRASONIC_ECHO_TIMEOUT_US);
  if (echoUs == 0) return false;

  *distanceCm = (float)echoUs * 0.01715f;
  return *distanceCm >= 1.0f;
}

static void resetLidSamples() {
  lidSampleCount = 0;
  lidSampleIndex = 0;
  lidClosedConfirmations = 0;
}

static bool medianLidDistance(float* distanceCm) {
  if (lidSampleCount < 3) return false;

  float values[3] = {
      lidDistanceSamples[0], lidDistanceSamples[1], lidDistanceSamples[2]};
  if (values[0] > values[1]) {
    const float swap = values[0]; values[0] = values[1]; values[1] = swap;
  }
  if (values[1] > values[2]) {
    const float swap = values[1]; values[1] = values[2]; values[2] = swap;
  }
  if (values[0] > values[1]) {
    const float swap = values[0]; values[0] = values[1]; values[1] = swap;
  }
  *distanceCm = values[1];
  return true;
}

static void sampleLid() {
  if (!due(nextLidSampleAt)) return;
  nextLidSampleAt = millis() + ULTRASONIC_SAMPLE_INTERVAL_MS;

  float distanceCm = 0.0f;
  if (!readLidDistanceCm(&distanceCm)) {
    resetLidSamples();
    setUv(false, "lid sensor timeout");
    return;
  }

  // Opening and unknown states are always fail-closed. Do not wait for the
  // median here: exposed UV must stop as soon as the lid is known open.
  if (distanceCm >= LID_OPEN_DISTANCE_CM) {
    resetLidSamples();
    setUv(false, "lid open");
    return;
  }

  if (distanceCm > LID_CLOSED_DISTANCE_CM) {
    lidClosedConfirmations = 0;
    return;
  }

  lidDistanceSamples[lidSampleIndex] = distanceCm;
  lidSampleIndex = (lidSampleIndex + 1) % 3;
  if (lidSampleCount < 3) ++lidSampleCount;

  float medianCm = 0.0f;
  if (!medianLidDistance(&medianCm)) return;
  if (medianCm > LID_CLOSED_DISTANCE_CM) {
    lidClosedConfirmations = 0;
    return;
  }

  if (lidClosedConfirmations < LID_CLOSED_CONFIRMATIONS) {
    ++lidClosedConfirmations;
  }
  if (lidClosedConfirmations >= LID_CLOSED_CONFIRMATIONS) {
    setUv(true, "lid closed");
  }
}
#else
static void sampleLid() {}
#endif

// --------------------------------------------------------------------------
// HTTP
// --------------------------------------------------------------------------

static bool jsonParsed(const char* fn, DeserializationError err) {
  if (!err) return true;

  Serial.printf("[http] %s: bad json: %s size=%d\n",
                fn, err.c_str(), http.getSize());
  return false;
}

// Returns the HTTP status code, or a negative HTTPClient error. On 200 the
// response body is parsed into `out` when `out` is non-null.
static int postRpc(const char* fn, const char* body, JsonDocument* out) {
  char url[160];
  snprintf(url, sizeof(url), "https://%s/rest/v1/rpc/%s", SUPABASE_HOST, fn);

  if (!http.begin(tlsClient, url)) {
    // Almost always a malformed URL from a bad SUPABASE_HOST in config.h, not
    // a transient fault -- printed with fn so it's clear which RPC call site
    // triggered it if this ever fires mid-sequence.
    Serial.printf("[http] %s: begin() failed - check SUPABASE_HOST in config.h\n", fn);
    return -1000;
  }

  http.addHeader(F("apikey"), F(SUPABASE_ANON_KEY));
  http.addHeader(F("Authorization"), F("Bearer " SUPABASE_ANON_KEY));
  http.addHeader(F("Content-Type"), F("application/json"));
  http.addHeader(F("Accept"), F("application/json"));

  int code = http.POST((uint8_t*)body, strlen(body));

  if (code == HTTP_CODE_OK && out != nullptr) {
    if (http.getSize() < 0) {
      // Supabase/PostgREST uses chunked transfer encoding for command rows.
      // getStream() exposes the raw chunk framing, which ArduinoJson rejects
      // as InvalidInput. getString() goes through HTTPClient's chunk decoder.
      // Idle polls still take the fixed-length stream path below, avoiding a
      // heap allocation on the steady-state 1 Hz request.
      String payload = http.getString();
      if (!jsonParsed(fn, deserializeJson(*out, payload))) {
        http.end();
        return -1001;
      }
    } else if (!jsonParsed(fn, deserializeJson(*out, http.getStream()))) {
      http.end();
      return -1001;
    }
  } else if (code == HTTP_CODE_OK) {
    // A successful RPC can still return a row. Consume it before reusing the
    // keep-alive socket, otherwise its bytes corrupt the next response.
    http.getString();
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
  cmdAborted = false;

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
    cmdAborted = false;
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
    cmdAborted = false;
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

static void reportDeviceStatus() {
  char body[448];
  snprintf(body, sizeof(body),
           R"json({"p_device_id":"%s","p_secret":"%s","p_tray_weight_g":%.2f,"p_tank_weight_g":%.2f,"p_uv_status":%s,"p_wifi_rssi":%d,"p_firmware_version":"%s"})json",
           DEVICE_ID, DEVICE_SECRET, trayWeightG(), 0.0f,
           uvOn ? "true" : "false", WiFi.RSSI(), FIRMWARE_VERSION);

  postRpc("device_report_reading", body, nullptr);
}

// --------------------------------------------------------------------------
// WiFi
// --------------------------------------------------------------------------
// True while the gate is, or is about to be, physically open.
static bool dispensing() {
  return state == ST_DISPENSE_OPEN
      || state == ST_DISPENSE_STOP_OPEN
      || state == ST_DISPENSE_WAIT
      || state == ST_DISPENSE_CLOSE
      || state == ST_DISPENSE_STOP_CLOSE;
}

// Fail-safe close. A continuous-rotation servo must receive an explicit
// reverse pulse for the measured gate travel, then neutral; merely detaching
// it would leave the gate in whichever position it had reached.
static void closeGate() {
  feedServo.attach(SERVO_PIN);
  feedServo.writeMicroseconds(SERVO_CLOSE_US);
  delay(SERVO_GATE_TRAVEL_MS);
  feedServo.writeMicroseconds(SERVO_NEUTRAL_US);
  delay(50);  // send several neutral pulses before detaching
  feedServo.detach();
}

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
  Serial.printf("[boot] reset=%s\n", ESP.getResetReason().c_str());

  // Keep a disconnect reason in Serial Monitor. This distinguishes an AP
  // rejection from a brownout/reset without changing connection behavior.
  wifiDisconnectHandler = WiFi.onStationModeDisconnected(
      [](const WiFiEventStationModeDisconnected& event) {
        Serial.printf("[wifi] disconnected reason=%d\n", event.reason);
      });

  initializeUv();
#if HAS_ULTRASONIC
  pinMode(ULTRASONIC_TRIG_PIN, OUTPUT);
  pinMode(ULTRASONIC_ECHO_PIN, INPUT);
  digitalWrite(ULTRASONIC_TRIG_PIN, LOW);
#endif

  // Park the continuous-rotation gate closed before anything else can take
  // time. The servo receives reverse motion only for the measured travel.
  closeGate();

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
  nextLidSampleAt = millis();

  // Resume an unreported result instead of dropping it. cmdId survives a WiFi
  // outage in exactly two cases: the network died between the gate closing
  // and the POST landing (device_report_result() accepts the late success
  // report), or it died mid-dispense (cmdAborted is set, reported as
  // "aborted"). Either way, going straight to ST_IDLE here would silently
  // drop the outcome and leave the command to rot until the server times it
  // out.
  state = (cmdId[0] != '\0') ? ST_REPORT : ST_IDLE;
  nextReportAt = millis();
  reportAttempts = 0;
}

void loop() {
  // --- connectivity -------------------------------------------------------
  if (WiFi.status() != WL_CONNECTED) {
    if (state != ST_WIFI_CONNECT) {
      Serial.println(F("[wifi] lost"));

      // Losing WiFi must not leave food pouring. The gate is closed
      // immediately, unconditionally of the network. cmdId is deliberately
      // NOT cleared here: ST_REPORT uses it to tell the server the real
      // outcome ("aborted") as soon as the connection comes back, rather than
      // leaving the command to rot until the server's 120s timeout — which
      // would also block a fresh Feed Now press for that whole window, since
      // the schema allows only one active command per device.
      if (dispensing()) {
        Serial.println(F("[servo] emergency close: wifi lost mid-dispense"));
        closeGate();
        cmdAborted = true;
      }

      // Force a fresh socket; session resumption makes reconnecting cheap.
      tlsClient.stop();
      wifiDownSince = millis();
      wifiBackoffMs = 15000;
      wifiRetryAt = millis() + wifiBackoffMs;
      state = ST_WIFI_CONNECT;
    }

    if (due(wifiRetryAt)) {
      // The SDK normally reconnects automatically. This is only a bounded
      // fallback after it has had time to finish, not a competing reconnect
      // loop that can repeatedly interrupt association or DHCP.
      Serial.printf("[wifi] reconnect fallback (wait %lu ms, status=%d)\n",
                    (unsigned long)wifiBackoffMs, WiFi.status());
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      wifiRetryAt = millis() + wifiBackoffMs;
      wifiBackoffMs = wifiBackoffMs < 30000 ? wifiBackoffMs * 2 : 30000;
    }

    // Five minutes with no network means something is wedged that a reboot
    // usually clears. Any command in flight is already safe: it sits in
    // `running` and the server's expire_stale_commands() fails it after 120s.
    if (wifiDownSince != 0 && due(wifiDownSince + 300000UL)) {
      Serial.println(F("[wifi] down 5 min, restarting"));
      // Belt-and-braces: the gate is already closed by the branch above, but a
      // reset drops the servo signal entirely, so make the mechanical state
      // explicit before losing control of the pin.
      closeGate();
      ESP.restart();
    }

    yield();
    return;
  }

  if (state == ST_WIFI_CONNECT) {
    Serial.print(F("[wifi] connected "));
    Serial.println(WiFi.localIP());
    wifiDownSince = 0;
    wifiBackoffMs = 15000;
    state = ST_NET_INIT;
  }

  if (state == ST_NET_INIT) {
    netInit();
    return;
  }

  sampleScale();
  sampleLid();

#if HAS_LOAD_CELL
  if (due(nextScaleLogAt)) {
    Serial.printf("[scale] raw=%ld tray=%.2fg\n", lastScaleRaw, lastTrayG);
    nextScaleLogAt = millis() + 5000UL;
  }
#endif

  if (due(nextHeapLogAt)) {
    Serial.printf("[heap] %u rssi=%d\n", ESP.getFreeHeap(), WiFi.RSSI());
    nextHeapLogAt = millis() + 30000UL;
  }

  // --- state machine ------------------------------------------------------
  switch (state) {
    case ST_IDLE: {
      // 18 KB leaves headroom for BearSSL while allowing the UV/lid state to run.
      // A low heap makes a TLS write fail in ways that look like a network
      // fault. Skip the cycle rather than thrash.
      if (ESP.getFreeHeap() < 18000) {
        yield();
        return;
      }

#if HAS_LOAD_CELL
      if (settlePending && due(settleAt)) {
        reportConsumption();
        return;
      }
#endif

      if (due(nextReadingAt)) {
#if HAS_LOAD_CELL
        reportReading();
#else
        reportDeviceStatus();
#endif
        nextReadingAt = millis() + READING_INTERVAL_MS;
        return;
      }

      if (due(nextPollAt)) {
        nextPollAt = millis() + POLL_INTERVAL_MS;
        pollForCommand();
      }
      break;
    }

    case ST_DISPENSE_OPEN: {
      trayBeforeG = trayWeightG();

      if (cmdTargetG <= 0.0f) {
        // Nothing to do — the tray already meets the target. Report success
        // so the command doesn't sit until it times out.
        haveWeights = false;
        state = ST_REPORT;
        nextReportAt = millis();
        break;
      }

#if HAS_LOAD_CELL
      // The target is the additional food requested for this command. Stop
      // before that target because material already beyond the gate continues
      // falling while the servo closes. For tiny requests, do not subtract the
      // entire coast allowance or the gate would close immediately.
      const float cutoffAmountG = cmdTargetG > DISPENSE_COAST_G
          ? cmdTargetG - DISPENSE_COAST_G
          : cmdTargetG;
      dispenseCloseAtG = trayBeforeG + cutoffAmountG;
      Serial.printf("[servo] opening %lu ms; target=%.1fg close-at=%.1fg timeout=%lu ms\n",
                    (unsigned long)SERVO_GATE_TRAVEL_MS, cmdTargetG,
                    dispenseCloseAtG, (unsigned long)MAX_DISPENSE_MS);
#else
      uint32_t dispenseMs = (uint32_t)((cmdTargetG / GRAMS_PER_SECOND) * 1000.0f);
      if (dispenseMs > MAX_DISPENSE_MS) dispenseMs = MAX_DISPENSE_MS;
      dispenseEndsAt = millis() + dispenseMs;
      Serial.printf("[servo] opening %lu ms; safety timeout=%lu ms\n",
                    (unsigned long)SERVO_GATE_TRAVEL_MS,
                    (unsigned long)dispenseMs);
#endif
      feedServo.attach(SERVO_PIN);
      feedServo.writeMicroseconds(SERVO_OPEN_US);
      servoMotionEndsAt = millis() + SERVO_GATE_TRAVEL_MS;
      state = ST_DISPENSE_STOP_OPEN;
      break;
    }

    case ST_DISPENSE_STOP_OPEN: {
      if (!due(servoMotionEndsAt)) {
        yield();
        break;
      }
      feedServo.writeMicroseconds(SERVO_NEUTRAL_US);
      delay(50);  // ensure the continuous-rotation motor has stopped
      feedServo.detach();
#if HAS_LOAD_CELL
      dispenseEndsAt = millis() + MAX_DISPENSE_MS;
#endif
      Serial.println(F("[servo] stopped open; waiting for tray weight"));
      state = ST_DISPENSE_WAIT;
      break;
    }

    case ST_DISPENSE_WAIT: {
      // The motor is stopped while the gate is open. Do not run network I/O
      // here so the load-cell cutoff remains responsive.
#if HAS_LOAD_CELL
      if (trayWeightG() >= dispenseCloseAtG) {
        Serial.printf("[servo] close by weight tray=%.1fg threshold=%.1fg\n",
                      trayWeightG(), dispenseCloseAtG);
        state = ST_DISPENSE_CLOSE;
        break;
      }
#endif
      if (due(dispenseEndsAt)) {
        Serial.println(F("[servo] close by safety timeout"));
        state = ST_DISPENSE_CLOSE;
      }
      yield();
      break;
    }

    case ST_DISPENSE_CLOSE: {
      feedServo.attach(SERVO_PIN);
      feedServo.writeMicroseconds(SERVO_CLOSE_US);
      servoMotionEndsAt = millis() + SERVO_GATE_TRAVEL_MS;
      Serial.printf("[servo] closing %lu ms\n", (unsigned long)SERVO_GATE_TRAVEL_MS);
      state = ST_DISPENSE_STOP_CLOSE;
      break;
    }

    case ST_DISPENSE_STOP_CLOSE: {
      if (!due(servoMotionEndsAt)) {
        yield();
        break;
      }
      feedServo.writeMicroseconds(SERVO_NEUTRAL_US);
      delay(50);  // send several neutral pulses before detaching
      feedServo.detach();
      Serial.println(F("[servo] stopped closed"));

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
      if (!due(nextReportAt)) break;

      // A dispense that was cut short by a WiFi drop is reported the moment
      // the connection is back, instead of waiting out the server's 120s
      // timeout. Checked ahead of the empty_tank heuristic below since the
      // weights from an interrupted dispense aren't meaningful anyway.
      if (cmdAborted) {
        reportResult(false, "aborted");
        break;
      }

#if HAS_LOAD_CELL
      // The load cell is the only thing that can tell "the gate opened" from
      // "food actually came out". If a full dispense added almost nothing to
      // the tray, the hopper is empty or the chute is jammed — reporting
      // success there would hide a real fault and let the low-eating alert
      // blame the pet for not eating food it never received.
      if (haveWeights && cmdTargetG > 0.0f &&
          (trayAfterG - trayBeforeG) < (cmdTargetG * 0.25f)) {
        Serial.printf("[servo] dispensed %.1fg of %.1fg target - reporting empty_tank\n",
                      trayAfterG - trayBeforeG, cmdTargetG);
        reportResult(false, "empty_tank");
        break;
      }
#endif

      reportResult(true, nullptr);
      break;
    }

    default:
      break;
  }

  yield();
}
