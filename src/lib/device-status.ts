import { isDeviceOnline } from "./device-health";

export const STATUS_REFRESH_INTERVAL_MS = 5_000;
export const DEVICE_STATUS_REASONS = [
  "online",
  "offline",
  "device_not_found",
  "unauthorized",
  "database_error",
] as const;

export type DeviceStatusReason = (typeof DEVICE_STATUS_REASONS)[number];

export interface DeviceStatusResponse {
  deviceId: string;
  exists: boolean;
  online: boolean;
  lastSeenAt: string | null;
  checkedAt: string;
  reason: DeviceStatusReason;
}

export interface DeviceHealthRpcResult {
  exists?: unknown;
  last_seen_at?: unknown;
  server_time?: unknown;
}

function nullableIso(value: unknown): string | null {
  return typeof value === "string" && !Number.isNaN(new Date(value).getTime())
    ? value
    : null;
}

/** Converts the database-owned health payload to the public API contract. */
export function deviceStatusFromHealth(
  deviceId: string,
  health: DeviceHealthRpcResult,
): DeviceStatusResponse {
  const checkedAt = nullableIso(health.server_time) ?? new Date().toISOString();
  const lastSeenAt = nullableIso(health.last_seen_at);
  const exists = health.exists === true;

  if (!exists) {
    return {
      deviceId,
      exists: false,
      online: false,
      lastSeenAt: null,
      checkedAt,
      reason: "device_not_found",
    };
  }

  const online = isDeviceOnline(lastSeenAt, checkedAt);
  return {
    deviceId,
    exists: true,
    online,
    lastSeenAt,
    checkedAt,
    reason: online ? "online" : "offline",
  };
}

export function unavailableDeviceStatus(
  deviceId: string,
  reason: Extract<DeviceStatusReason, "unauthorized" | "database_error">,
): DeviceStatusResponse {
  return {
    deviceId,
    exists: false,
    online: false,
    lastSeenAt: null,
    checkedAt: new Date().toISOString(),
    reason,
  };
}

export function canFeedNow(status: DeviceStatusResponse | null): boolean {
  return status?.reason === "online";
}