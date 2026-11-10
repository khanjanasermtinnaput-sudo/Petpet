# Shuttle launcher (badminton)

A badminton shuttle launcher machine controlled from the web. **Unrelated to
pet feeding** — it only shares this Supabase project and the Vercel domain with
PetPet. It owns its tables (`launcher_*`) and functions; nothing in the pet
feeder touches them and vice versa. Dropping every `launcher_*` object removes
it cleanly.

The machine does not exist yet. Everything here is built so the web side can be
developed and tested against `scripts/launcher-sim.mjs`, and the firmware can be
written later against a fixed protocol.

---

## 1. Architecture

```
Browser ──POST /api/launcher/command──▶ Next.js ──rpc enqueue_launcher_command──▶ Supabase
Browser ──POST /api/launcher/stop─────▶ Next.js ──rpc request_launcher_stop──────▶    │
                                                                                      │
Machine ──poll (rpc device_poll_launcher_command, anon key + device secret)──────────▶│
        ◀── {id, speed_pct, pitch_deg, yaw_deg, interval_ms, shuttle_count}          │
        ├─ after EVERY shuttle: rpc device_report_launcher_progress ─────────────────▶│
        │      ◀── {stop: true|false}                                                 │
        ├─ rpc device_report_launcher_result  (success / failed + error code)         │
        └─ rpc device_report_launcher_state   (battery, temp, shuttles left, …)       │
```

The machine talks **directly to Supabase**, not to Vercel (a 1 Hz poll through
serverless functions would be ~86k invocations/day). The anon key in its
headers is public and authenticates nothing; the real credential is a
per-machine secret checked as a sha256 hash inside `SECURITY DEFINER` functions
against `launcher_devices`, which is deny-all.

## 2. Tables

| Table | Purpose | anon access |
|---|---|---|
| `launcher_devices` | machine id + `secret_hash` | none |
| `launcher_commands` | queue + history of drills | SELECT (needed for Realtime) |
| `launcher_status` | live telemetry | SELECT |

`launcher_commands` doubles as your **own training data** later: every drill
with its parameters, outcome and error code is logged.

Command parameters (CHECK constraints, mirrored in `src/lib/launcher-commands.ts`):

| Field | Range |
|---|---|
| `speed_pct` | 10–100 (int) |
| `pitch_deg` | −10–60 |
| `yaw_deg` | −45–45 |
| `interval_ms` | 800–10000 (int; floor = mechanical feed cycle) |
| `shuttle_count` | 1–100 (int) |

One live (`pending`/`running`) command per machine is enforced by a partial
unique index.

## 3. Firmware protocol

All calls are `POST {SUPABASE_URL}/rest/v1/rpc/<name>` with headers
`apikey` + `Authorization: Bearer <anon key>` and a JSON body that always
includes `p_device_id` and `p_secret`. HTTP **403** = wrong secret.

| RPC | Extra args | Returns |
|---|---|---|
| `device_poll_launcher_command` | – | `null` (idle) or the command to run; marks it `running` |
| `device_report_launcher_progress` | `p_command_id`, `p_launched_count` | `{stop}` — **halt if true** |
| `device_report_launcher_result` | `p_command_id`, `p_success`, `p_launched_count?`, `p_error?` | `{status}`; idempotent |
| `device_report_launcher_state` | `p_state` (`idle`/`armed`/`launching`/`error`), `p_shuttles_left?`, `p_battery_pct?`, `p_motor_temp_c?`, `p_wifi_rssi?`, `p_firmware_version?`, `p_last_error?` | `{ok}` |

Error codes the firmware should use in `p_error`: `not_armed`, `no_shuttles`,
`jam`, `motor_fault`, `over_temp`, `aborted`, `device_error`.

Timeouts (lazy, evaluated on poll / health check — no pg_cron):
- `pending` for 60 s → `failed: timeout_pickup`
- `running` with no progress report for 30 s → `failed: timeout_execute`

### Safety — firmware must own this

The database cannot make a launcher safe. The firmware must:

1. **Stop on its own** if it cannot reach the server for >5 s (do not wait for a
   `stop` it cannot receive). If `device_report_launcher_progress` returns
   `stop: true` — or fails repeatedly — halt the motors.
2. Refuse to run unless a **physical arm switch** is on (`not_armed`).
3. Re-check limits locally; never trust the range check upstream.
4. Cut the motors on over-temperature or jam.
5. Report progress **after every shuttle**: that is both the stop channel and
   the heartbeat that keeps the command alive.

## 4. Security (known gap)

`enqueue_launcher_command` takes no secret — the web app runs on the public anon
key, so anyone who can guess `SHUTTLE-001` can queue a launch. For a pet feeder
that was tolerable; for a machine that throws objects it is not, **before the
machine is ever pointed at a person**. Closing it needs real authentication on
`/api/launcher/*` (e.g. a server-only shared token or Supabase Auth) and moving
`enqueue_launcher_command` behind the service-role key. `request_launcher_stop`
is deliberately left open: it can only make the machine do less.

## 5. Setting it up

```bash
# 1. Register a machine (prints SQL + a one-time secret)
node scripts/provision-launcher.mjs SHUTTLE-001 "Court 1"
#    -> run the printed SQL in Supabase; keep DEVICE_SECRET out of git

# 2. Apply supabase/migrations/20261110000000_shuttle_launcher.sql

# 3. Run the simulator in place of the machine (.env.local needs
#    NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY and LAUNCHER_DEVICE_SECRET)
node --env-file=.env.local scripts/launcher-sim.mjs --speed=10

# 4. Drive it from the web side
curl -X POST $APP/api/launcher/command -H 'content-type: application/json' \
  -d '{"speedPct":60,"pitchDeg":25,"yawDeg":0,"intervalMs":2000,"shuttleCount":10}'
curl -X POST $APP/api/launcher/stop
curl $APP/api/launcher/status
```

Simulator flags: `--fail=jam` (fail the next drill at shuttle 3), `--speed=10`
(10× faster), `--poll=<ms>`.

## 6. Training data for the AI part

No ready-made *badminton coaching text* dataset exists, so the practical path is
to combine open tactical/trajectory data with your own logged drills. Verify each
licence before use.

| Dataset | What it is | Use for |
|---|---|---|
| ShuttleSet / ShuttleSet22 (CoachAI) | stroke-level pro singles: 36k strokes (44 matches); ShuttleSet22 adds 2022 matches | realistic shot sequences, next-shot and landing-zone patterns → drill generation |
| TrackNet / TrackNetV2 dataset (NYCU) | 26 broadcast videos with per-frame shuttle trajectory CSVs | real flight arcs → speed/pitch ↔ landing calibration |
| MultiSenseBadminton (GIST / MIT CSAIL) | 23 h of swing sensor data, 25 players, labelled stroke type / skill level | coaching assistant, stroke classification |
| Roboflow Universe shuttlecock sets | frame-level detection | detecting the shuttle if you add a camera |
| T3Set (table tennis, KDD'25) | video + sensor + text coaching suggestions | **template** for building a badminton text set |
| TennisLLMv1 (Hugging Face) | tiny Alpaca-style tennis coaching Q&A | format template only (answers are thin) |

A 2024 IEEE Access study found LLMs hallucinate on intricate motor skills such
as badminton, so prefer **grounding over fine-tuning**: keep drill rules and
limits in a verified knowledge base, have the LLM output only a validated
`{speedPct, pitchDeg, yawDeg, intervalMs, shuttleCount}`, and run it through
`validateLaunchParams()` before it can reach the machine.
