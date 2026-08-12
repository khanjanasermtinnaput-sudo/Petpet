/**
 * Manual sanity script for the real Gemini feeding-schedule generation.
 *
 * Not run in CI or `npm test` — Gemini is a non-deterministic generative
 * model, so this only asserts loose directional sanity (never crashes,
 * never returns <=0 grams, heavier pet doesn't get less food) and prints a
 * comparison table for a human to eyeball the rest.
 *
 * Run with: npm run test:gemini-schedule
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenAI } from "@google/genai";
import { buildSchedulePrompt } from "../src/lib/schedule-prompt";
import { checkReportedNutrition, computeExpectedNutrition, type ReportedNutrition } from "../src/lib/vet-nutrition";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadDotEnvLocal() {
  const envPath = path.join(__dirname, "..", ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && !(key in process.env)) process.env[key] = value;
  }
}

loadDotEnvLocal();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.log("[test-gemini-schedule] GEMINI_API_KEY not set (checked process.env and .env.local) — skipping.");
  process.exit(0);
}

// Local copy of route.ts's SCHEDULE_SCHEMA — not exported by the route, so
// this must be kept in sync by hand if the route's schema ever changes.
const SCHEDULE_SCHEMA = {
  type: "object",
  properties: {
    rer_kcal: { type: "number", description: "Resting Energy Requirement in kcal/day = 70 × weight_kg^0.75." },
    life_stage_factor: { type: "number", description: "Life-stage multiplier selected from the species/age table given in the prompt." },
    mer_kcal: { type: "number", description: "Maintenance Energy Requirement in kcal/day = rer_kcal × life_stage_factor." },
    kcal_per_gram_assumed: { type: "number", description: "Assumed food calorie density in kcal/gram — always 3.5 for this app's default kibble assumption." },
    daily_target_g: { type: "number", description: "Total daily food target in grams = mer_kcal ÷ kcal_per_gram_assumed; equals the sum of all meals' target_g." },
    meals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          meal_slot: { type: "string", enum: ["breakfast", "lunch", "dinner"] },
          time_of_day: { type: "string", description: "24-hour time as HH:MM, e.g. 07:30" },
          target_g: { type: "number" },
        },
        required: ["meal_slot", "time_of_day", "target_g"],
        additionalProperties: false,
      },
    },
  },
  required: ["rer_kcal", "life_stage_factor", "mer_kcal", "kcal_per_gram_assumed", "daily_target_g", "meals"],
  additionalProperties: false,
};

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const MEAL_SLOTS = ["breakfast", "lunch", "dinner"];

interface Meal {
  meal_slot: string;
  time_of_day: string;
  target_g: number;
}

interface Fixture {
  group: string;
  label: string;
  species: string;
  breed: string | null;
  weight_kg: number;
  age_years: number;
  age_months: number;
}

const FIXTURES: Fixture[] = [
  { group: "age", label: "cat kitten", species: "Cat", breed: null, weight_kg: 3, age_years: 0, age_months: 2 },
  { group: "age", label: "cat adult", species: "Cat", breed: null, weight_kg: 3, age_years: 5, age_months: 0 },
  { group: "weight", label: "small dog", species: "Dog", breed: null, weight_kg: 5, age_years: 2, age_months: 0 },
  { group: "weight", label: "large dog", species: "Dog", breed: null, weight_kg: 25, age_years: 2, age_months: 0 },
  { group: "species", label: "cat", species: "Cat", breed: null, weight_kg: 4, age_years: 1, age_months: 0 },
  { group: "species", label: "dog", species: "Dog", breed: null, weight_kg: 4, age_years: 1, age_months: 0 },
];

const RUNS_PER_FIXTURE = 3;

interface Result {
  fixture: Fixture;
  run: number;
  valid: boolean;
  mealsSumG: number | null;
  meals: Meal[] | null;
  nutritionOk: boolean | null;
  nutritionFailures: string[];
  rerKcal: number | null;
  lifeStageFactor: number | null;
  merKcal: number | null;
  dailyTargetGReported: number | null;
  dailyTargetGExpected: number;
}

function validateMeals(meals: unknown): meals is Meal[] {
  if (!Array.isArray(meals)) return false;
  const bySlot = new Map(meals.map((m: Meal) => [m.meal_slot, m]));
  const valid = MEAL_SLOTS.every((slot) => {
    const m = bySlot.get(slot);
    return !!m && TIME_PATTERN.test(m.time_of_day) && typeof m.target_g === "number" && m.target_g > 0;
  });
  return valid && bySlot.size >= MEAL_SLOTS.length;
}

async function runOnce(ai: GoogleGenAI, fixture: Fixture, run: number): Promise<Result> {
  const dailyTargetGExpected = computeExpectedNutrition(fixture).dailyTargetG;
  const base = { fixture, run, dailyTargetGExpected };

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        responseSchema: SCHEDULE_SCHEMA,
      },
      contents: [{ role: "user", parts: [{ text: buildSchedulePrompt(fixture) }] }],
    });

    if (!response.text) {
      return { ...base, valid: false, mealsSumG: null, meals: null, nutritionOk: null, nutritionFailures: [], rerKcal: null, lifeStageFactor: null, merKcal: null, dailyTargetGReported: null };
    }

    const parsed = JSON.parse(response.text) as ReportedNutrition & { meals: Meal[] };
    if (!validateMeals(parsed.meals)) {
      return { ...base, valid: false, mealsSumG: null, meals: parsed.meals ?? null, nutritionOk: null, nutritionFailures: [], rerKcal: null, lifeStageFactor: null, merKcal: null, dailyTargetGReported: null };
    }

    const mealsSumG = parsed.meals.reduce((sum, m) => sum + m.target_g, 0);
    const nutritionCheck = checkReportedNutrition(fixture, parsed, mealsSumG);

    return {
      ...base,
      valid: true,
      mealsSumG,
      meals: parsed.meals,
      nutritionOk: nutritionCheck.ok,
      nutritionFailures: nutritionCheck.failures,
      rerKcal: parsed.rer_kcal,
      lifeStageFactor: parsed.life_stage_factor,
      merKcal: parsed.mer_kcal,
      dailyTargetGReported: parsed.daily_target_g,
    };
  } catch (err) {
    console.error(`[test-gemini-schedule] run failed for ${fixture.label} (run ${run}):`, err);
    return { ...base, valid: false, mealsSumG: null, meals: null, nutritionOk: null, nutritionFailures: [], rerKcal: null, lifeStageFactor: null, merKcal: null, dailyTargetGReported: null };
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function main() {
  const ai = new GoogleGenAI({ apiKey });
  const results: Result[] = [];

  // The free tier allows only 5 requests/minute for gemini-2.5-flash; space
  // calls out to stay under that instead of bursting all 18 at once.
  let first = true;
  for (const fixture of FIXTURES) {
    for (let run = 1; run <= RUNS_PER_FIXTURE; run++) {
      if (!first) await sleep(13_000);
      first = false;
      results.push(await runOnce(ai, fixture, run));
    }
  }

  let failed = false;

  console.log("\n=== Per-run results ===");
  console.table(
    results.map((r) => ({
      group: r.fixture.group,
      label: r.fixture.label,
      species: r.fixture.species,
      weight_kg: r.fixture.weight_kg,
      age: `${r.fixture.age_years}y${r.fixture.age_months}m`,
      run: r.run,
      valid: r.valid,
      rer_kcal: r.rerKcal?.toFixed(1) ?? "N/A",
      life_stage_factor: r.lifeStageFactor ?? "N/A",
      mer_kcal: r.merKcal?.toFixed(1) ?? "N/A",
      daily_target_g: r.dailyTargetGReported?.toFixed(1) ?? "N/A",
      expected_g: r.dailyTargetGExpected.toFixed(1),
      nutrition_ok: r.nutritionOk ?? "N/A",
      breakfast_g: r.meals?.find((m) => m.meal_slot === "breakfast")?.target_g ?? "",
      lunch_g: r.meals?.find((m) => m.meal_slot === "lunch")?.target_g ?? "",
      dinner_g: r.meals?.find((m) => m.meal_slot === "dinner")?.target_g ?? "",
    })),
  );

  // Hard assertion: every run must produce schema-valid output.
  const invalid = results.filter((r) => !r.valid);
  if (invalid.length > 0) {
    console.error(`\nFAIL: ${invalid.length}/${results.length} runs did not produce valid schedule output.`);
    failed = true;
  } else {
    console.log(`\nOK: all ${results.length} runs produced valid schedule output.`);
  }

  // Hard assertion: mealsSumG always > 0 (implied by validateMeals, checked explicitly).
  const nonPositive = results.filter((r) => r.valid && (r.mealsSumG ?? 0) <= 0);
  if (nonPositive.length > 0) {
    console.error(`FAIL: ${nonPositive.length} valid run(s) had mealsSumG <= 0.`);
    failed = true;
  }

  // Hard assertion: Gemini's self-reported RER/MER/gram numbers must track the
  // real formula (checkReportedNutrition — the same validator route.ts uses).
  const nutritionFails = results.filter((r) => r.valid && r.nutritionOk === false);
  if (nutritionFails.length > 0) {
    console.error(`\nFAIL: ${nutritionFails.length}/${results.length} valid runs failed the vet-formula nutrition check:`);
    for (const r of nutritionFails) {
      console.error(`  - ${r.fixture.label} run ${r.run}: ${r.nutritionFailures.join("; ")}`);
    }
    failed = true;
  } else {
    console.log("OK: all valid runs' reported RER/MER/grams matched the formula within tolerance.");
  }

  // Hard assertion: within the weight group, heavier pet's average mealsSumG
  // must not be less than the lighter pet's average (same species/age).
  const weightGroup = results.filter((r) => r.fixture.group === "weight" && r.valid);
  const avgFor = (label: string) => {
    const rs = weightGroup.filter((r) => r.fixture.label === label);
    return rs.length > 0 ? rs.reduce((s, r) => s + (r.mealsSumG ?? 0), 0) / rs.length : null;
  };
  const smallAvg = avgFor("small dog");
  const largeAvg = avgFor("large dog");
  if (smallAvg !== null && largeAvg !== null) {
    console.log(`\nWeight-direction check: small dog avg=${smallAvg.toFixed(1)}g, large dog avg=${largeAvg.toFixed(1)}g`);
    if (largeAvg < smallAvg) {
      console.error("FAIL: heavier dog's average mealsSumG is less than the lighter dog's — direction is wrong.");
      failed = true;
    } else {
      console.log("OK: heavier dog's average mealsSumG is not less than the lighter dog's.");
    }
  } else {
    console.warn("WARN: could not compute weight-direction check — one of the two weight-group fixtures had no valid runs.");
  }

  // Logged only, per the task's own assert-scope: age and species differences
  // are expected but not hard-asserted, since single LLM comparisons can be noisy.
  const ageGroup = results.filter((r) => r.fixture.group === "age" && r.valid);
  const kittenAvg = ageGroup.filter((r) => r.fixture.label === "cat kitten").reduce((s, r, _, arr) => s + (r.mealsSumG ?? 0) / arr.length, 0);
  const adultAvg = ageGroup.filter((r) => r.fixture.label === "cat adult").reduce((s, r, _, arr) => s + (r.mealsSumG ?? 0) / arr.length, 0);
  console.log(`\nAge comparison (informational only): kitten avg=${kittenAvg.toFixed(1)}g, adult avg=${adultAvg.toFixed(1)}g`);

  const speciesGroup = results.filter((r) => r.fixture.group === "species" && r.valid);
  const catAvg = speciesGroup.filter((r) => r.fixture.label === "cat").reduce((s, r, _, arr) => s + (r.mealsSumG ?? 0) / arr.length, 0);
  const dogAvg = speciesGroup.filter((r) => r.fixture.label === "dog").reduce((s, r, _, arr) => s + (r.mealsSumG ?? 0) / arr.length, 0);
  console.log(`Species comparison (informational only): cat avg=${catAvg.toFixed(1)}g, dog avg=${dogAvg.toFixed(1)}g`);

  if (failed) {
    console.error("\nFAILED — see above.");
    process.exitCode = 1;
  } else {
    console.log("\nAll hard assertions passed.");
  }
}

main();
