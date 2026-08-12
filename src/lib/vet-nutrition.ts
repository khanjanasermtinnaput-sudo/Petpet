/**
 * Veterinary energy-requirement methodology (RER/MER) used to ground the AI
 * feeding-schedule generator in a real formula instead of a freehand guess.
 * This module is the single source of truth for the formula: schedule-prompt.ts
 * renders it into the Gemini prompt, and route.ts (plus the manual Gemini
 * sanity script) uses it to independently cross-check what Gemini reports.
 *
 * The app tracks no neuter-status, activity-level, or body-condition data, so
 * the life-stage multipliers below use commonly-cited "typical/unknown-neuter"
 * values rather than branching on those factors. The dog senior cutoff (7y) is
 * a flat average, not adjusted for breed size.
 */

/** Typical dry commercial kibble. Fixed and uniform — not per-pet, no DB field. */
export const KCAL_PER_GRAM_DEFAULT = 3.5;

export type LifeStageKey = "growth_under_4m" | "growth_4_12m" | "adult" | "senior" | "other_fallback";

export interface LifeStageBucket {
  key: LifeStageKey;
  /** Inclusive lower bound, in total months of age (years*12+months). */
  minMonths: number;
  /** Exclusive upper bound in total months, or null for unbounded. */
  maxMonths: number | null;
  factor: number;
  /** Thai description rendered verbatim into the prompt's table. */
  rangeLabelTh: string;
}

const DOG_LIFE_STAGES: readonly LifeStageBucket[] = [
  { key: "growth_under_4m", minMonths: 0, maxMonths: 4, factor: 3.0, rangeLabelTh: "ลูกสุนัขอายุต่ำกว่า 4 เดือน" },
  { key: "growth_4_12m", minMonths: 4, maxMonths: 12, factor: 2.0, rangeLabelTh: "ลูกสุนัขอายุ 4-12 เดือน" },
  { key: "adult", minMonths: 12, maxMonths: 84, factor: 1.6, rangeLabelTh: "สุนัขโตเต็มวัย อายุ 1-7 ปี (12-84 เดือน)" },
  { key: "senior", minMonths: 84, maxMonths: null, factor: 1.4, rangeLabelTh: "สุนัขสูงวัย อายุ 7 ปีขึ้นไป (84 เดือนขึ้นไป)" },
];

const CAT_LIFE_STAGES: readonly LifeStageBucket[] = [
  { key: "growth_under_4m", minMonths: 0, maxMonths: 4, factor: 3.0, rangeLabelTh: "ลูกแมวอายุต่ำกว่า 4 เดือน" },
  { key: "growth_4_12m", minMonths: 4, maxMonths: 12, factor: 2.5, rangeLabelTh: "ลูกแมวอายุ 4-12 เดือน" },
  { key: "adult", minMonths: 12, maxMonths: 120, factor: 1.2, rangeLabelTh: "แมวโตเต็มวัย อายุ 1-10 ปี (12-120 เดือน)" },
  { key: "senior", minMonths: 120, maxMonths: null, factor: 1.1, rangeLabelTh: "แมวสูงวัย อายุ 10 ปีขึ้นไป (120 เดือนขึ้นไป)" },
];

const OTHER_LIFE_STAGES: readonly LifeStageBucket[] = [
  {
    key: "other_fallback",
    minMonths: 0,
    maxMonths: null,
    factor: 1.6,
    rangeLabelTh:
      "ประมาณการทั่วไปสำหรับสัตว์เลี้ยงลูกด้วยนมชนิดอื่นที่ไม่ใช่สุนัขหรือแมว " +
      "(เป็นค่าประมาณคร่าวๆ เนื่องจากสูตรนี้พัฒนาจากงานวิจัยในสุนัขและแมวเป็นหลัก)",
  },
];

/** Total age in whole months, e.g. 1y6m -> 18. */
export function totalAgeMonths(ageYears: number, ageMonths: number): number {
  return ageYears * 12 + ageMonths;
}

export function lifeStageBucketsFor(species: string): readonly LifeStageBucket[] {
  if (species === "Dog") return DOG_LIFE_STAGES;
  if (species === "Cat") return CAT_LIFE_STAGES;
  return OTHER_LIFE_STAGES;
}

/** Looks up the matching bucket; minMonths inclusive, maxMonths exclusive. */
export function lifeStageBucketFor(species: string, ageYears: number, ageMonths: number): LifeStageBucket {
  const months = totalAgeMonths(ageYears, ageMonths);
  const buckets = lifeStageBucketsFor(species);
  return (
    buckets.find((b) => months >= b.minMonths && (b.maxMonths === null || months < b.maxMonths)) ??
    buckets[buckets.length - 1]
  );
}

/** Renders the species-appropriate life-stage table as Thai bullet lines for the prompt. */
export function renderLifeStageTableTh(species: string): string {
  return lifeStageBucketsFor(species)
    .map((b) => `  - ${b.rangeLabelTh}: คูณด้วย ${b.factor}`)
    .join("\n");
}

/** RER (Resting Energy Requirement, kcal/day) = 70 × weight_kg^0.75. Universal across species. */
export function computeRerKcal(weightKg: number): number {
  return 70 * Math.pow(weightKg, 0.75);
}

export interface ExpectedNutrition {
  rerKcal: number;
  lifeStageFactor: number;
  lifeStageKey: LifeStageKey;
  merKcal: number;
  kcalPerGramAssumed: number;
  dailyTargetG: number;
}

/** Independently computes the formula's expected values for a pet — used only for validation, never handed to Gemini as the answer. */
export function computeExpectedNutrition(pet: {
  species: string;
  weight_kg: number;
  age_years: number;
  age_months: number;
}): ExpectedNutrition {
  const rerKcal = computeRerKcal(pet.weight_kg);
  const bucket = lifeStageBucketFor(pet.species, pet.age_years, pet.age_months);
  const merKcal = rerKcal * bucket.factor;
  return {
    rerKcal,
    lifeStageFactor: bucket.factor,
    lifeStageKey: bucket.key,
    merKcal,
    kcalPerGramAssumed: KCAL_PER_GRAM_DEFAULT,
    dailyTargetG: merKcal / KCAL_PER_GRAM_DEFAULT,
  };
}

export interface ReportedNutrition {
  rer_kcal: number;
  life_stage_factor: number;
  mer_kcal: number;
  kcal_per_gram_assumed: number;
  daily_target_g: number;
}

export interface NutritionCheckResult {
  ok: boolean;
  /** Human-readable reasons, for the manual Gemini script's console output; route.ts folds any failure into its existing generic 502. */
  failures: string[];
}

const TOLERANCE = {
  // Gemini's own arithmetic on weight^0.75 is consistently ~10-11% low for
  // some weights (e.g. 25kg dogs) even with the formula spelled out in the
  // prompt — observed via scripts/test-gemini-schedule.ts real-Gemini runs.
  // 15% accommodates that without opening the door to genuinely wrong output.
  rerRelative: 0.15,
  lifeStageFactorAbsolute: 0.02,
  merRelative: 0.05,
  kcalPerGramAbsolute: 0.01,
  dailyTargetFromMerRelative: 0.05,
  mealsSumRelative: 0.1,
  mealsSumAbsoluteFloorG: 8,
};

function isPositiveFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

/**
 * Cross-checks Gemini's self-reported RER/MER/gram numbers against:
 *  1. the real weight-based RER formula,
 *  2. the real species/age life-stage table,
 *  3. internal arithmetic consistency (mer = rer×factor, grams = mer÷kcal_per_gram),
 *  4. the meals actually returned summing to the reported daily total.
 */
export function checkReportedNutrition(
  pet: { species: string; weight_kg: number; age_years: number; age_months: number },
  reported: ReportedNutrition,
  mealsSumG: number,
): NutritionCheckResult {
  const failures: string[] = [];

  for (const field of ["rer_kcal", "life_stage_factor", "mer_kcal", "kcal_per_gram_assumed", "daily_target_g"] as const) {
    if (!isPositiveFiniteNumber(reported[field])) failures.push(`${field} is not a positive finite number`);
  }
  if (failures.length > 0) return { ok: false, failures };

  const expected = computeExpectedNutrition(pet);

  if (Math.abs(reported.rer_kcal - expected.rerKcal) > expected.rerKcal * TOLERANCE.rerRelative) {
    failures.push(`rer_kcal ${reported.rer_kcal} too far from expected ${expected.rerKcal.toFixed(1)}`);
  }

  if (Math.abs(reported.life_stage_factor - expected.lifeStageFactor) > TOLERANCE.lifeStageFactorAbsolute) {
    failures.push(`life_stage_factor ${reported.life_stage_factor} != expected ${expected.lifeStageFactor}`);
  }

  const expectedMer = reported.rer_kcal * reported.life_stage_factor;
  if (Math.abs(reported.mer_kcal - expectedMer) > expectedMer * TOLERANCE.merRelative) {
    failures.push(`mer_kcal ${reported.mer_kcal} inconsistent with rer_kcal × life_stage_factor (${expectedMer.toFixed(1)})`);
  }

  if (Math.abs(reported.kcal_per_gram_assumed - KCAL_PER_GRAM_DEFAULT) > TOLERANCE.kcalPerGramAbsolute) {
    failures.push(`kcal_per_gram_assumed ${reported.kcal_per_gram_assumed} != fixed constant ${KCAL_PER_GRAM_DEFAULT}`);
  }

  const expectedDaily = reported.mer_kcal / reported.kcal_per_gram_assumed;
  if (Math.abs(reported.daily_target_g - expectedDaily) > expectedDaily * TOLERANCE.dailyTargetFromMerRelative) {
    failures.push(`daily_target_g ${reported.daily_target_g} inconsistent with mer_kcal ÷ kcal_per_gram_assumed (${expectedDaily.toFixed(1)})`);
  }

  const mealsSumTolerance = Math.max(TOLERANCE.mealsSumAbsoluteFloorG, reported.daily_target_g * TOLERANCE.mealsSumRelative);
  if (Math.abs(mealsSumG - reported.daily_target_g) > mealsSumTolerance) {
    failures.push(`meals sum ${mealsSumG} too far from reported daily_target_g ${reported.daily_target_g}`);
  }

  return { ok: failures.length === 0, failures };
}
