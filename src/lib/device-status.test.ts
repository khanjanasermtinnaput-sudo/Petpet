import { describe, expect, it } from "vitest";
import {
  canFeedNow,
  deviceStatusFromHealth,
  unavailableDeviceStatus,
} from "./device-status";

const DEVICE_ID = "PETFEEDER-001";
const NOW = "2026-08-02T10:00:00.000Z";

describe("deviceStatusFromHealth", () => {
  it("reports a recent database heartbeat as online", () => {
    const status = deviceStatusFromHealth(DEVICE_ID, {
      exists: true,
      last_seen_at: "2026-08-02T09:59:45.000Z",
      server_time: NOW,
    });
    expect(status.reason).toBe("online");
    expect(status.online).toBe(true);
    expect(canFeedNow(status)).toBe(true);
  });

  it("reports a stale heartbeat as offline", () => {
    const status = deviceStatusFromHealth(DEVICE_ID, {
      exists: true,
      last_seen_at: "2026-08-02T09:59:39.000Z",
      server_time: NOW,
    });
    expect(status.reason).toBe("offline");
    expect(status.online).toBe(false);
    expect(canFeedNow(status)).toBe(false);
  });

  it("distinguishes a missing device from an offline device", () => {
    const status = deviceStatusFromHealth(DEVICE_ID, { exists: false, server_time: NOW });
    expect(status.reason).toBe("device_not_found");
    expect(status.exists).toBe(false);
    expect(status.lastSeenAt).toBeNull();
  });

  it("fails closed for malformed timestamps", () => {
    const status = deviceStatusFromHealth(DEVICE_ID, {
      exists: true,
      last_seen_at: "invalid",
      server_time: NOW,
    });
    expect(status.reason).toBe("offline");
  });

  it("returns a non-sensitive database error payload", () => {
    const status = unavailableDeviceStatus(DEVICE_ID, "database_error");
    expect(status.reason).toBe("database_error");
    expect(status.online).toBe(false);
  });
});