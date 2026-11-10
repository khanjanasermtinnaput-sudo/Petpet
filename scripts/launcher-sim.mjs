#!/usr/bin/env node
// Software stand-in for the shuttle launcher, for developing the web side
// before the real machine exists. Speaks the exact protocol the firmware will:
// poll -> run (progress after every shuttle, obey `stop`) -> result.
//
//   node --env-file=.env.local scripts/launcher-sim.mjs
//
// Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
//      LAUNCHER_DEVICE_SECRET, LAUNCHER_DEVICE_ID (default SHUTTLE-001)
// Flags: --fail=<code>   fail the next drill after 2 shuttles (e.g. jam)
//        --speed=<x>     time multiplier, default 1 (use 10 for fast tests)
//        --poll=<ms>     poll interval, default 1000
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const secret = process.env.LAUNCHER_DEVICE_SECRET;
const deviceId = process.env.LAUNCHER_DEVICE_ID ?? "SHUTTLE-001";
const flag = (n, d) => process.argv.find((a) => a.startsWith(`--${n}=`))?.split("=")[1] ?? d;
const failCode = flag("fail", null);
const speed = Number(flag("speed", "1"));
const pollMs = Number(flag("poll", "1000"));

if (!url || !anon || !secret) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / LAUNCHER_DEVICE_SECRET");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function rpc(name, args) {
  const res = await fetch(`${url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: anon, Authorization: `Bearer ${anon}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_device_id: deviceId, p_secret: secret, ...args }),
  });
  if (res.status === 403) throw new Error("403 unauthorized device — wrong DEVICE_SECRET?");
  if (!res.ok) throw new Error(`${name} -> HTTP ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

let shuttlesLeft = 100;
let failNext = failCode;

const report = (state, extra = {}) =>
  rpc("device_report_launcher_state", {
    p_state: state,
    p_shuttles_left: shuttlesLeft,
    p_battery_pct: 87,
    p_motor_temp_c: 31.5,
    p_wifi_rssi: -55,
    p_firmware_version: "sim-0.1",
    ...extra,
  });

async function runDrill(cmd) {
  log(`drill ${cmd.id.slice(0, 8)}: ${cmd.shuttle_count} shuttles, speed ${cmd.speed_pct}%, pitch ${cmd.pitch_deg}°, yaw ${cmd.yaw_deg}°, every ${cmd.interval_ms}ms`);
  await report("launching");
  let launched = 0;
  for (let i = 1; i <= cmd.shuttle_count; i++) {
    if (shuttlesLeft === 0) return finish(cmd, false, launched, "no_shuttles");
    if (failNext && i === 3) return finish(cmd, false, launched, failNext);
    await sleep(cmd.interval_ms / speed); // motors spin up, feeder cycles, shuttle leaves
    launched = i;
    shuttlesLeft--;
    const r = await rpc("device_report_launcher_progress", {
      p_command_id: cmd.id,
      p_launched_count: launched,
    });
    log(`  shuttle ${launched}/${cmd.shuttle_count}`);
    // `stop` also comes back true if the server gave up on this command.
    if (r?.stop) {
      log("  stop requested -> halting");
      return finish(cmd, false, launched, "aborted");
    }
  }
  return finish(cmd, true, launched, null);
}

async function finish(cmd, success, launched, error) {
  const r = await rpc("device_report_launcher_result", {
    p_command_id: cmd.id,
    p_success: success,
    p_launched_count: launched,
    p_error: error,
  });
  failNext = null;
  log(`result: ${success ? "success" : `failed (${error})`} ->`, r?.status);
  await report(error && error !== "aborted" ? "error" : "armed", { p_last_error: error && error !== "aborted" ? error : null });
}

log(`simulator for ${deviceId} polling every ${pollMs}ms (Ctrl+C to quit)`);
await report("armed");
let sinceState = 0;
for (;;) {
  try {
    const cmd = await rpc("device_poll_launcher_command", {});
    if (cmd) await runDrill(cmd);
    sinceState += pollMs;
    if (sinceState >= 30_000) { await report("armed"); sinceState = 0; }
  } catch (e) {
    log("error:", e.message);
  }
  await sleep(pollMs);
}
