import { describe, expect, it } from "vitest";
import {
  connectionLabel,
  isDeviceOnline,
  lastSeenLabel,
  OFFLINE_AFTER_MS,
} from "./device-health";

const NOW = "2026-07-28T12:00:00Z";

function ago(ms: number): string {
  return new Date(new Date(NOW).getTime() - ms).toISOString();
}

describe("isDeviceOnline", () => {
  it("counts a recent heartbeat as online", () => {
    expect(isDeviceOnline(ago(5_000), NOW)).toBe(true);
  });

  it("counts a stale heartbeat as offline", () => {
    expect(isDeviceOnline(ago(60_000), NOW)).toBe(false);
  });

  it("is exclusive at exactly the threshold", () => {
    expect(isDeviceOnline(ago(OFFLINE_AFTER_MS - 1), NOW)).toBe(true);
    expect(isDeviceOnline(ago(OFFLINE_AFTER_MS), NOW)).toBe(false);
  });

  it("treats a device that has never checked in as offline", () => {
    expect(isDeviceOnline(null, NOW)).toBe(false);
  });

  it("tolerates a heartbeat timestamped after the server time", () => {
    // Sub-round-trip clock skew, not a dead device.
    expect(isDeviceOnline(ago(-2_000), NOW)).toBe(true);
  });

  it("does not claim online on an unparseable timestamp", () => {
    expect(isDeviceOnline("not a date", NOW)).toBe(false);
  });

  it("respects a caller-supplied threshold", () => {
    expect(isDeviceOnline(ago(45_000), NOW, 60_000)).toBe(true);
    expect(isDeviceOnline(ago(45_000), NOW)).toBe(false);
  });
});

describe("connectionLabel", () => {
  it("labels both states distinctly", () => {
    expect(connectionLabel(true)).toBe("ออนไลน์");
    expect(connectionLabel(false)).toBe("ออฟไลน์");
  });
});

describe("lastSeenLabel", () => {
  it("describes a device that has never checked in", () => {
    expect(lastSeenLabel(null, NOW)).toBe("ไม่เคยเชื่อมต่อ");
  });

  it("collapses anything under a minute", () => {
    expect(lastSeenLabel(ago(30_000), NOW)).toBe("เมื่อสักครู่");
  });

  it("rounds down through minutes, hours and days", () => {
    expect(lastSeenLabel(ago(5 * 60_000), NOW)).toBe("5 นาทีที่แล้ว");
    // 119 minutes is not yet 2 hours.
    expect(lastSeenLabel(ago(119 * 60_000), NOW)).toBe("1 ชั่วโมงที่แล้ว");
    expect(lastSeenLabel(ago(3 * 24 * 60 * 60_000), NOW)).toBe("3 วันที่แล้ว");
  });

  it("switches units exactly at the boundaries", () => {
    expect(lastSeenLabel(ago(60_000), NOW)).toBe("1 นาทีที่แล้ว");
    expect(lastSeenLabel(ago(60 * 60_000), NOW)).toBe("1 ชั่วโมงที่แล้ว");
    expect(lastSeenLabel(ago(24 * 60 * 60_000), NOW)).toBe("1 วันที่แล้ว");
  });

  it("does not guess on an unparseable timestamp", () => {
    expect(lastSeenLabel("not a date", NOW)).toBe("ไม่ทราบ");
  });
});
