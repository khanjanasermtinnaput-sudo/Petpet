/** The shuttle launcher paired with this single-tenant application. */
export const LAUNCHER_DEVICE_ID = "SHUTTLE-001";

/**
 * Hard limits for a launch command. These mirror the CHECK constraints in
 * 20261110000000_shuttle_launcher.sql and must also be enforced by firmware —
 * the web layer is a convenience, not the safety layer.
 */
export const LAUNCH_LIMITS = {
  speedPct: { min: 10, max: 100 },
  pitchDeg: { min: -10, max: 60 },
  yawDeg: { min: -45, max: 45 },
  intervalMs: { min: 800, max: 10_000 },
  shuttleCount: { min: 1, max: 100 },
} as const;

export interface LaunchParams {
  speedPct: number;
  pitchDeg: number;
  yawDeg: number;
  intervalMs: number;
  shuttleCount: number;
}

export type LaunchValidation =
  | { ok: true; params: LaunchParams }
  | { ok: false; field: keyof LaunchParams; message: string };

function inRange(
  value: unknown,
  { min, max }: { min: number; max: number },
  integer: boolean,
): value is number {
  return (
    typeof value === "number" &&
    Number.isFinite(value) &&
    value >= min &&
    value <= max &&
    (!integer || Number.isInteger(value))
  );
}

/**
 * Validates an untrusted request body. Rejects rather than clamps: silently
 * turning speed 500 into 100 would launch something the caller never asked for.
 */
export function validateLaunchParams(body: unknown): LaunchValidation {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<
    string,
    unknown
  >;
  const L = LAUNCH_LIMITS;

  if (!inRange(b.speedPct, L.speedPct, true)) {
    return { ok: false, field: "speedPct", message: `speedPct ต้องเป็นจำนวนเต็ม ${L.speedPct.min}-${L.speedPct.max}` };
  }
  if (!inRange(b.pitchDeg, L.pitchDeg, false)) {
    return { ok: false, field: "pitchDeg", message: `pitchDeg ต้องอยู่ระหว่าง ${L.pitchDeg.min} ถึง ${L.pitchDeg.max}` };
  }
  if (!inRange(b.yawDeg, L.yawDeg, false)) {
    return { ok: false, field: "yawDeg", message: `yawDeg ต้องอยู่ระหว่าง ${L.yawDeg.min} ถึง ${L.yawDeg.max}` };
  }
  if (!inRange(b.intervalMs, L.intervalMs, true)) {
    return { ok: false, field: "intervalMs", message: `intervalMs ต้องเป็นจำนวนเต็ม ${L.intervalMs.min}-${L.intervalMs.max}` };
  }
  if (!inRange(b.shuttleCount, L.shuttleCount, true)) {
    return { ok: false, field: "shuttleCount", message: `shuttleCount ต้องเป็นจำนวนเต็ม ${L.shuttleCount.min}-${L.shuttleCount.max}` };
  }

  return {
    ok: true,
    params: {
      speedPct: b.speedPct,
      pitchDeg: b.pitchDeg,
      yawDeg: b.yawDeg,
      intervalMs: b.intervalMs,
      shuttleCount: b.shuttleCount,
    },
  };
}

export interface LauncherRpcArgs {
  p_device_id: string;
  p_speed_pct: number;
  p_pitch_deg: number;
  p_yaw_deg: number;
  p_interval_ms: number;
  p_shuttle_count: number;
}

export function launcherRpcArgs(deviceId: string, p: LaunchParams): LauncherRpcArgs {
  return {
    p_device_id: deviceId,
    p_speed_pct: p.speedPct,
    p_pitch_deg: p.pitchDeg,
    p_yaw_deg: p.yawDeg,
    p_interval_ms: p.intervalMs,
    p_shuttle_count: p.shuttleCount,
  };
}

/** Thai text for the machine-readable error codes the firmware reports. */
const LAUNCH_ERROR_MESSAGES: Record<string, string> = {
  timeout_pickup: "ไม่พบเครื่องยิง กรุณาตรวจสอบการเชื่อมต่อ",
  timeout_execute: "เครื่องยิงหยุดตอบสนอง คำสั่งถูกยกเลิก",
  aborted: "การยิงถูกหยุด",
  not_armed: "เครื่องยังไม่ได้เปิดสวิตช์พร้อมยิง (arm)",
  no_shuttles: "ลูกแบดหมดในเครื่อง",
  jam: "ลูกแบดติดในกลไกป้อน",
  motor_fault: "มอเตอร์ขัดข้อง",
  over_temp: "มอเตอร์ร้อนเกินไป กรุณารอให้เย็นลง",
  device_error: "เครื่องยิงขัดข้อง กรุณาลองใหม่",
};

export interface LaunchOutcome {
  status: string;
  shuttle_count: number;
  launched_count: number;
  error: string | null;
}

export function launchResultMessage(o: LaunchOutcome): string {
  if (o.status === "success") return `ยิงครบ ${o.launched_count} ลูก`;
  const reason = (o.error ? LAUNCH_ERROR_MESSAGES[o.error] : undefined) ??
    LAUNCH_ERROR_MESSAGES.device_error;
  return o.launched_count > 0
    ? `${reason} (ยิงไปแล้ว ${o.launched_count}/${o.shuttle_count} ลูก)`
    : reason;
}

/**
 * The machine heartbeats at most every 10s while idle (see
 * device_poll_launcher_command), so 30s is three missed beats.
 */
export const LAUNCHER_ONLINE_WINDOW_MS = 30_000;

/** Uses the database clock for both sides so server/client skew cannot matter. */
export function isLauncherOnline(lastSeenAt: unknown, serverTime: unknown): boolean {
  if (typeof lastSeenAt !== "string" || typeof serverTime !== "string") return false;
  const seen = Date.parse(lastSeenAt);
  const now = Date.parse(serverTime);
  if (Number.isNaN(seen) || Number.isNaN(now)) return false;
  return now - seen <= LAUNCHER_ONLINE_WINDOW_MS;
}

export interface LauncherHealth {
  exists: boolean;
  online: boolean;
  state: string | null;
  lastSeenAt: string | null;
  shuttlesLeft: number | null;
  batteryPct: number | null;
  motorTempC: number | null;
  firmwareVersion: string | null;
  wifiRssi: number | null;
  lastError: string | null;
  activeCommands: number;
  checkedAt: string;
}

/** Public API shape for the launcher_health() RPC payload. */
export function launcherHealthFromRpc(raw: unknown): LauncherHealth {
  const h = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : null);
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const exists = h.exists === true;
  const lastSeenAt = str(h.last_seen_at);
  const checkedAt = str(h.server_time) ?? new Date().toISOString();
  return {
    exists,
    online: exists && isLauncherOnline(lastSeenAt, checkedAt),
    state: str(h.state),
    lastSeenAt,
    shuttlesLeft: num(h.shuttles_left),
    batteryPct: num(h.battery_pct),
    motorTempC: num(h.motor_temp_c),
    firmwareVersion: str(h.firmware_version),
    wifiRssi: num(h.wifi_rssi),
    lastError: str(h.last_error),
    activeCommands: num(h.active_commands) ?? 0,
    checkedAt,
  };
}
