import { describe, expect, it } from "vitest";
import {
  LAUNCH_LIMITS,
  launchResultMessage,
  launcherHealthFromRpc,
  launcherRpcArgs,
  validateLaunchParams,
} from "./launcher-commands";

const valid = { speedPct: 60, pitchDeg: 25, yawDeg: 0, intervalMs: 2000, shuttleCount: 20 };

describe("validateLaunchParams", () => {
  it("accepts a normal drill", () => {
    expect(validateLaunchParams(valid)).toEqual({ ok: true, params: valid });
  });

  it("accepts both ends of every range", () => {
    const L = LAUNCH_LIMITS;
    expect(validateLaunchParams({
      speedPct: L.speedPct.min, pitchDeg: L.pitchDeg.min, yawDeg: L.yawDeg.min,
      intervalMs: L.intervalMs.min, shuttleCount: L.shuttleCount.min,
    }).ok).toBe(true);
    expect(validateLaunchParams({
      speedPct: L.speedPct.max, pitchDeg: L.pitchDeg.max, yawDeg: L.yawDeg.max,
      intervalMs: L.intervalMs.max, shuttleCount: L.shuttleCount.max,
    }).ok).toBe(true);
  });

  it.each([
    ["speedPct", 101],
    ["speedPct", 9],
    ["speedPct", 50.5],
    ["pitchDeg", 61],
    ["pitchDeg", -11],
    ["yawDeg", 46],
    ["yawDeg", -46],
    ["intervalMs", 799],
    ["intervalMs", 10_001],
    ["shuttleCount", 0],
    ["shuttleCount", 101],
    ["shuttleCount", 2.5],
  ] as const)("rejects %s = %s instead of clamping it", (field, value) => {
    const result = validateLaunchParams({ ...valid, [field]: value });
    expect(result).toMatchObject({ ok: false, field });
  });

  it.each([null, undefined, "60", NaN, Infinity])(
    "rejects non-numeric speedPct %s",
    (value) => {
      expect(validateLaunchParams({ ...valid, speedPct: value })).toMatchObject({
        ok: false,
        field: "speedPct",
      });
    },
  );

  it("rejects a missing or non-object body", () => {
    expect(validateLaunchParams(null).ok).toBe(false);
    expect(validateLaunchParams("x").ok).toBe(false);
    expect(validateLaunchParams({}).ok).toBe(false);
  });
});

describe("launcherRpcArgs", () => {
  it("maps to the RPC parameter names", () => {
    expect(launcherRpcArgs("SHUTTLE-001", valid)).toEqual({
      p_device_id: "SHUTTLE-001",
      p_speed_pct: 60,
      p_pitch_deg: 25,
      p_yaw_deg: 0,
      p_interval_ms: 2000,
      p_shuttle_count: 20,
    });
  });
});

describe("launchResultMessage", () => {
  it("reports a completed drill", () => {
    expect(launchResultMessage({ status: "success", shuttle_count: 20, launched_count: 20, error: null }))
      .toBe("ยิงครบ 20 ลูก");
  });

  it("includes partial progress on a failure", () => {
    expect(launchResultMessage({ status: "failed", shuttle_count: 20, launched_count: 7, error: "jam" }))
      .toContain("ยิงไปแล้ว 7/20");
  });

  it("omits progress when nothing was launched", () => {
    expect(launchResultMessage({ status: "failed", shuttle_count: 20, launched_count: 0, error: "not_armed" }))
      .not.toContain("ยิงไปแล้ว");
  });

  it("falls back for an unknown error code", () => {
    expect(launchResultMessage({ status: "failed", shuttle_count: 5, launched_count: 0, error: "???" }))
      .toBe("เครื่องยิงขัดข้อง กรุณาลองใหม่");
  });
});

describe("launcherHealthFromRpc", () => {
  const base = {
    exists: true,
    server_time: "2026-11-10T10:00:30Z",
    last_seen_at: "2026-11-10T10:00:10Z",
    state: "armed",
    shuttles_left: 42,
    battery_pct: 80,
    active_commands: 1,
  };

  it("is online when the machine was seen within the window", () => {
    expect(launcherHealthFromRpc(base)).toMatchObject({
      exists: true,
      online: true,
      state: "armed",
      shuttlesLeft: 42,
      batteryPct: 80,
      activeCommands: 1,
    });
  });

  it("is offline once the heartbeat is older than the window", () => {
    expect(
      launcherHealthFromRpc({ ...base, last_seen_at: "2026-11-10T09:59:00Z" }).online,
    ).toBe(false);
  });

  it("is offline for a registered machine that never checked in", () => {
    expect(launcherHealthFromRpc({ ...base, last_seen_at: null }).online).toBe(false);
  });

  it("is never online for an unknown device, even with a fresh timestamp", () => {
    expect(launcherHealthFromRpc({ ...base, exists: false }).online).toBe(false);
  });

  it("survives garbage input", () => {
    expect(launcherHealthFromRpc(null)).toMatchObject({ exists: false, online: false });
    expect(launcherHealthFromRpc({ shuttles_left: "x" }).shuttlesLeft).toBeNull();
  });
});
