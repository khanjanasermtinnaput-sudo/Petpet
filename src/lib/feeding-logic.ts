import type { MealSlot } from "./types";

export interface FeedEventSlice {
  meal_slot: MealSlot;
  actual_eaten_g: number;
  ts: string;
}

/**
 * Amount to dispense so the tray reaches `targetG`, given what's already there.
 * Never negative — an overfull tray dispenses nothing.
 */
export function computeDispenseAmount(
  targetG: number,
  currentTrayWeightG: number,
): number {
  return Math.max(0, targetG - currentTrayWeightG);
}

/**
 * Mean `actual_eaten_g` across the most recent `n` events for a meal slot,
 * ordered newest-first. Returns 0 when there's no history for that slot,
 * so callers must treat a 0 baseline as "no data" rather than "ate zero".
 */
export function rollingAverageForSlot(
  events: FeedEventSlice[],
  slot: MealSlot,
  n: number,
): number {
  const slotEvents = events
    .filter((e) => e.meal_slot === slot)
    .sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime())
    .slice(0, n);

  if (slotEvents.length === 0) return 0;

  const total = slotEvents.reduce((sum, e) => sum + e.actual_eaten_g, 0);
  return total / slotEvents.length;
}

/**
 * Flags a meal as "ate less than usual" against a rolling-average baseline.
 * With no baseline (0 = no prior history), never flags — avoids false
 * alerts on a pet's very first meals.
 */
export function isEatingLow(
  actualEatenG: number,
  baselineAvgG: number,
  threshold = 0.7,
): boolean {
  if (baselineAvgG <= 0) return false;
  return actualEatenG < baselineAvgG * threshold;
}
