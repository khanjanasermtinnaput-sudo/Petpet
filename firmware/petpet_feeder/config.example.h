// Copy this file to config.h and fill it in. config.h is gitignored — it
// holds the device secret, which is the only real credential in the system.
//
//   cp config.example.h config.h
//
#ifndef PETPET_CONFIG_H
#define PETPET_CONFIG_H

// ----------------------------------------------------------------- network ---
#define WIFI_SSID       "your-wifi"
#define WIFI_PASSWORD   "your-wifi-password"

// ---------------------------------------------------------------- supabase ---
// Host only — no https://, no trailing slash.
#define SUPABASE_HOST   "apttrjvugklhdpvapxeh.supabase.co"

// The publishable/anon key. This is public by design (the browser ships it
// too) and is NOT what authenticates this device. Never put the service-role
// key here.
#define SUPABASE_ANON_KEY "paste-the-anon-key"

// ------------------------------------------------------------------ device ---
// Must match a row in the devices table.
#define DEVICE_ID       "PETFEEDER-001"

// The actual credential. Generate 32 random bytes and register the sha256 of
// this exact string — see docs/HARDWARE.md, "Provisioning a feeder".
//
//   openssl rand -hex 32
//
#define DEVICE_SECRET   "paste-the-provisioning-token"

// Reported to device_status.firmware_version so you can tell which feeder is
// running what without unplugging it.
#define FIRMWARE_VERSION "1.0.0"

// ------------------------------------------------------------------- servo ---
// D5. Avoid GPIO0/2/15: they are boot-strapping pins, and a servo signal on
// GPIO0 at power-up drops the board into flash mode instead of booting.
#define SERVO_PIN            14
#define SERVO_CLOSED_ANGLE   0
#define SERVO_OPEN_ANGLE     90

// How fast food leaves the hopper with the gate open. Calibrate once: open
// the gate for 10 seconds, weigh what came out, divide by 10. This is what
// converts a target in grams into a gate-open duration.
#define GRAMS_PER_SECOND     5.0f

// Safety stop. However large a command is, never hold the gate open longer
// than this — a mis-set GRAMS_PER_SECOND should not empty the whole hopper.
#define MAX_DISPENSE_MS      15000

// ------------------------------------------------------------------ timing ---
#define POLL_INTERVAL_MS     1000UL      // 1 Hz, as designed
#define READING_INTERVAL_MS  60000UL     // tray/tank weight, load cell only
#define SETTLE_DELAY_MS      1800000UL   // 30 min, load cell only

// --------------------------------------------------------------- load cell ---
// Off by default: the base build needs only ESP8266WiFi, WiFiClientSecure,
// HTTPClient, ArduinoJson and Servo, and a servo-only feeder works fine — it
// just estimates the dispensed amount from GRAMS_PER_SECOND instead of
// measuring it.
//
// Set to 1 if an HX711 + load cell is fitted. That is what makes
// feeder_readings, real dispensed weights, and actual_eaten_g (the tray-weight
// delta after the pet has eaten) possible. Without it those stay empty and the
// low-eating alert never has data. No extra library is needed; the HX711
// protocol is implemented inline.
#define HAS_LOAD_CELL        0

#define HX711_DOUT_PIN       12          // D6
#define HX711_SCK_PIN        13          // D7

// Raw reading with an empty tray (tare), and raw counts per gram.
// See docs/HARDWARE.md, "Calibrating the load cell".
#define SCALE_TARE_RAW       0L
#define SCALE_COUNTS_PER_G   420.0f

// --------------------------------------------------------------------- TLS ---
// 0 (default): trust any certificate. The device transmits the public anon
// key plus its device secret, so an *active on-path attacker on your LAN*
// could steal the secret and cause feeds on this one device — they still
// could not read the devices table, touch another feeder, or forge history.
// For a home feeder that is the right trade.
//
// 1: verify against ROOT_CA_PEM below and require NTP. Read the TLS section
// of docs/HARDWARE.md first — enabling this means you own certificate-chain
// rotation, and every deployed feeder stops working if the CDN in front of
// Supabase switches issuing CAs.
#define PIN_ROOT_CA          0

// Paste the current root, e.g. https://letsencrypt.org/certs/isrgrootx1.pem
// It is left blank deliberately: shipping a hardcoded root would rot silently.
//
// Adjacent string-literal concatenation, not a raw string literal — verified
// against a real build of this project's exact toolchain
// (xtensa-lx106-elf-g++, esp8266 core 3.1.2): a multi-line R"EOF(...)EOF"
// fails there with "unterminated raw string" even in complete isolation, one
// line per PEM line, unrelated to anything else in this file. Single-line
// raw strings compile fine on the same toolchain — it is specifically the
// multi-line form that is broken. Each line needs its own trailing "\n":
// PEM parsers split on newlines between the base64 lines.
//
// Defined unconditionally, not inside "#if PIN_ROOT_CA" — costs nothing when
// PIN_ROOT_CA is 0, since the .ino only ever reads ROOT_CA_PEM inside its own
// "#if PIN_ROOT_CA".
#define ROOT_CA_PEM \
  "-----BEGIN CERTIFICATE-----\n" \
  "...paste here...\n" \
  "-----END CERTIFICATE-----\n"

#endif  // PETPET_CONFIG_H
