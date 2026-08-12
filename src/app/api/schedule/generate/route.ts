import { NextResponse } from "next/server";
import { generateScheduleText } from "@/lib/ai-provider";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/active-pet";
import { buildSchedulePrompt } from "@/lib/schedule-prompt";
import type { FeedingSchedule, MealSlot } from "@/lib/types";
import { checkReportedNutrition } from "@/lib/vet-nutrition";

const MEAL_SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "dinner"];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

interface GeneratedMeal {
  meal_slot: string;
  time_of_day: string;
  target_g: number;
}

interface GeneratedSchedule {
  rer_kcal: number;
  life_stage_factor: number;
  mer_kcal: number;
  kcal_per_gram_assumed: number;
  daily_target_g: number;
  meals: GeneratedMeal[];
}

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
          time_of_day: {
            type: "string",
            description: "24-hour time as HH:MM, e.g. 07:30",
          },
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

export async function POST() {
  if (!process.env.GEMINI_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์" },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  const pet = await getPet(supabase);

  if (!pet) {
    return NextResponse.json({ error: "ไม่พบข้อมูลสัตว์เลี้ยง" }, { status: 404 });
  }

  let meals: GeneratedMeal[];
  let nutritionReport: Omit<GeneratedSchedule, "meals">;
  try {
    const responseText = await generateScheduleText({
      prompt: buildSchedulePrompt(pet),
      schema: SCHEDULE_SCHEMA,
    });
    const parsed = JSON.parse(responseText) as GeneratedSchedule;
    meals = parsed.meals;
    nutritionReport = {
      rer_kcal: parsed.rer_kcal,
      life_stage_factor: parsed.life_stage_factor,
      mer_kcal: parsed.mer_kcal,
      kcal_per_gram_assumed: parsed.kcal_per_gram_assumed,
      daily_target_g: parsed.daily_target_g,
    };
  } catch {
    // Don't leak raw SyntaxError/SDK error text (e.g. a JSON.parse failure
    // on a truncated response) to the user — same friendly message as the
    // validation-failure path below.
    return NextResponse.json(
      { error: "AI ไม่สามารถวางแผนตารางอาหารที่ถูกต้องได้ กรุณาลองใหม่" },
      { status: 502 },
    );
  }

  const bySlot = new Map(meals.map((m) => [m.meal_slot, m]));
  const validMeals = MEAL_SLOTS.map((slot) => bySlot.get(slot)).filter(
    (m): m is GeneratedMeal =>
      !!m && TIME_PATTERN.test(m.time_of_day) && typeof m.target_g === "number" && m.target_g > 0,
  );

  if (validMeals.length !== MEAL_SLOTS.length) {
    return NextResponse.json(
      { error: "AI ไม่สามารถวางแผนตารางอาหารที่ถูกต้องได้ กรุณาลองใหม่" },
      { status: 502 },
    );
  }

  const totalDailyG = validMeals.reduce((sum, m) => sum + m.target_g, 0);

  const nutritionCheck = checkReportedNutrition(pet, nutritionReport, totalDailyG);
  if (!nutritionCheck.ok) {
    return NextResponse.json(
      { error: "AI ไม่สามารถวางแผนตารางอาหารที่ถูกต้องได้ กรุณาลองใหม่" },
      { status: 502 },
    );
  }

  const { error: upsertError } = await supabase.from("feeding_schedule").upsert(
    validMeals.map((m) => ({
      device_id: pet.device_id,
      pet_id: pet.id,
      meal_slot: m.meal_slot,
      time_of_day: m.time_of_day,
      target_g: m.target_g,
      source: "ai",
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "pet_id,meal_slot" },
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  await supabase.from("pets").update({ daily_target_g: Math.round(totalDailyG) }).eq("id", pet.id);

  const { data: schedule, error: fetchError } = await supabase
    .from("feeding_schedule")
    .select("*")
    .eq("pet_id", pet.id)
    .order("time_of_day", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ schedule: (schedule ?? []) as FeedingSchedule[] });
}
