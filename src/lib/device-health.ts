/**
 * How long since the last heartbeat before a feeder counts as offline.
 *
 * The firmware polls at 1 Hz but only refreshes last_seen_at every 10s (an
 * unconditional write would broadcast on the realtime channel once per second
 * for nothing), so this must comfortably clear that throttle. 30s tolerates
 * two missed heartbeats plus a slow round trip.
 */
/** Firmware writes a heartbeat at most every 10 seconds. */
export const DEVICE_HEARTBEAT_INTERVAL_MS = 10_000;

/** Two missed heartbeats are tolerated before declaring the feeder offline. */
export const OFFLINE_AFTER_MS = DEVICE_HEARTBEAT_INTERVAL_MS * 2;

/**
 * Judged against the *server's* clock, not the browser's.
 *
 * device_health() returns `server_time` alongside `last_seen_at` precisely so
 * a viewer whose laptop clock is wrong doesn't see a healthy feeder as dead.
 * A device that has never checked in has no last_seen_at and is offline.
 */
export function isDeviceOnline(
  lastSeenAt: string | null,
  serverTimeIso: string,
  thresholdMs = OFFLINE_AFTER_MS,
): boolean {
  if (!lastSeenAt) return false;

  const age = new Date(serverTimeIso).getTime() - new Date(lastSeenAt).getTime();
  if (Number.isNaN(age)) return false;

  // Negative age means the device checked in "after" the server time we were
  // handed — clock skew inside one round trip. Treat it as freshly seen.
  return age < thresholdMs;
}

export function connectionLabel(online: boolean): string {
  return online ? "ออนไลน์" : "ออฟไลน์";
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/**
 * Thai relative time for a heartbeat, e.g. "5 นาทีที่แล้ว".
 *
 * Coarse on purpose: the exact second a feeder last spoke is noise, and
 * rounding down keeps the label from claiming more freshness than there is.
 */
export function lastSeenLabel(lastSeenAt: string | null, nowIso: string): string {
  if (!lastSeenAt) return "ไม่เคยเชื่อมต่อ";

  const age = new Date(nowIso).getTime() - new Date(lastSeenAt).getTime();
  if (Number.isNaN(age)) return "ไม่ทราบ";

  if (age < MINUTE_MS) return "เมื่อสักครู่";
  if (age < HOUR_MS) return `${Math.floor(age / MINUTE_MS)} นาทีที่แล้ว`;
  if (age < DAY_MS) return `${Math.floor(age / HOUR_MS)} ชั่วโมงที่แล้ว`;
  return `${Math.floor(age / DAY_MS)} วันที่แล้ว`;
}
