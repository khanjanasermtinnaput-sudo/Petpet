import { describe, expect, it } from "vitest";
import {
  computeDispenseAmount,
  isEatingLow,
  rollingAverageForSlot,
  type FeedEventSlice,
} from "./feeding-logic";

describe("computeDispenseAmount", () => {
  it("dispenses the shortfall between target and current tray weight", () => {
    expect(computeDispenseAmount(80, 40)).toBe(40);
  });

  it("clamps to 0 when the tray already meets the target", () => {
    expect(computeDispenseAmount(80, 80)).toBe(0);
  });

  it("clamps to 0 rather than going negative when the tray overshoots", () => {
    expect(computeDispenseAmount(80, 120)).toBe(0);
  });

  it("dispenses the full target when the tray is empty", () => {
    expect(computeDispenseAmount(80, 0)).toBe(80);
  });
});

describe("rollingAverageForSlot", () => {
  const events: FeedEventSlice[] = [
    { meal_slot: "breakfast", actual_eaten_g: 30, ts: "2026-07-18T07:00:00Z" },
    { meal_slot: "breakfast", actual_eaten_g: 40, ts: "2026-07-19T07:00:00Z" },
    { meal_slot: "breakfast", actual_eaten_g: 50, ts: "2026-07-20T07:00:00Z" },
    { meal_slot: "dinner", actual_eaten_g: 60, ts: "2026-07-20T19:00:00Z" },
  ];

  it("averages only the matching slot, newest-first, capped at n", () => {
    expect(rollingAverageForSlot(events, "breakfast", 2)).toBe(45); // (40+50)/2
  });

  it("averages all matching events when fewer than n exist", () => {
    expect(rollingAverageForSlot(events, "breakfast", 10)).toBe(40); // (30+40+50)/3
  });

  it("returns 0 for a slot with no history (no false baseline)", () => {
    expect(rollingAverageForSlot(events, "lunch", 5)).toBe(0);
  });
});

describe("isEatingLow", () => {
  it("flags a meal below the default 70% threshold", () => {
    expect(isEatingLow(30, 50)).toBe(true); // 30 < 35
  });

  it("does not flag a meal at or above the threshold", () => {
    expect(isEatingLow(35, 50)).toBe(false); // exactly 70%
    expect(isEatingLow(45, 50)).toBe(false);
  });

  it("never flags when there is no baseline yet", () => {
    expect(isEatingLow(5, 0)).toBe(false);
  });

  it("respects a configurable threshold", () => {
    // 44 < 50*0.9 (45) -> flagged at a stricter 90% threshold...
    expect(isEatingLow(44, 50, 0.9)).toBe(true);
    // ...but the same 44 is not flagged at the default 70% threshold (35).
    expect(isEatingLow(44, 50)).toBe(false);
  });
});
