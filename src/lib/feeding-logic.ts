import type { MealSlot } from "./types";

export interface FeedEventSlice {
  meal_slot: MealSlot;
  actual_eaten_g: number;
  ts: string;
}

const BANGKOK_HOUR = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Bangkok",
  hour: "2-digit",
  // hourCycle over hour12:false — the latter renders midnight as "24" on some
  // ICU builds, which would bucket 00:xx as dinner.
  hourCycle: "h23",
});

/**
 * Meal slot for a moment in time, in the pet's local timezone.
 *
 * Pinned to Asia/Bangkok rather than the host clock: Vercel functions run with
 * TZ=UTC no matter which region they're pinned to (`regions` in vercel.json
 * controls latency, not the clock), so the `new Date().getHours()` this
 * replaces put Bangkok lunch and dinner in the wrong buckets — 12:00 local
 * read as breakfast and 18:00 as lunch. Postgres now() is UTC under PostgREST
 * too, so moving the boundaries into SQL would not have fixed it either.
 */
export function mealSlotForDate(date: Date): MealSlot {
  const hour = Number(BANGKOK_HOUR.format(date));
  if (hour < 11) return "breakfast";
  if (hour < 17) return "lunch";
  return "dinner";
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
