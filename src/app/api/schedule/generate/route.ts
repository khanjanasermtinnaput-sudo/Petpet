import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/device";
import type { FeedingSchedule, MealSlot } from "@/lib/types";

const MEAL_SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "dinner"];
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

interface GeneratedMeal {
  meal_slot: string;
  time_of_day: string;
  target_g: number;
}

const SCHEDULE_SCHEMA = {
  type: "object",
  properties: {
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
  required: ["meals"],
  additionalProperties: false,
};

function buildPrompt(pet: { species: string; weight_kg: number; age_years: number; age_months: number }): string {
  return `คุณคือ AI สัตวแพทย์ผู้ช่วยวางแผนตารางการให้อาหารสัตว์เลี้ยง

ข้อมูลสัตว์เลี้ยง:
- ชนิด: ${pet.species === "Cat" ? "แมว" : pet.species === "Dog" ? "หมา" : pet.species}
- น้ำหนัก: ${pet.weight_kg} กก.
- อายุ: ${pet.age_years} ปี ${pet.age_months} เดือน

จงวางแผนตารางการให้อาหาร 3 มื้อต่อวัน (เช้า กลางวัน เย็น) โดยใช้หลักโภชนาการสัตว์เลี้ยงทั่วไปตามชนิดและน้ำหนักของสัตว์ กำหนดเวลาที่เหมาะสมสำหรับแต่ละมื้อ และปริมาณอาหารเป็นกรัมต่อมื้อที่เหมาะสมต่อสุขภาพ`;
}

export async function POST() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
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

  const ai = new GoogleGenAI({ apiKey });

  let meals: GeneratedMeal[];
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      config: {
        maxOutputTokens: 1024,
        responseMimeType: "application/json",
        responseSchema: SCHEDULE_SCHEMA,
      },
      contents: [{ role: "user", parts: [{ text: buildPrompt(pet) }] }],
    });

    if (!response.text) throw new Error("no text in response");

    const parsed = JSON.parse(response.text) as { meals: GeneratedMeal[] };
    meals = parsed.meals;
  } catch (err) {
    const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดจาก AI สัตวแพทย์";
    return NextResponse.json({ error: message }, { status: 502 });
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

  const { error: upsertError } = await supabase.from("feeding_schedule").upsert(
    validMeals.map((m) => ({
      device_id: pet.device_id,
      meal_slot: m.meal_slot,
      time_of_day: m.time_of_day,
      target_g: m.target_g,
      source: "ai",
      updated_at: new Date().toISOString(),
    })),
    { onConflict: "device_id,meal_slot" },
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  const totalDailyG = validMeals.reduce((sum, m) => sum + m.target_g, 0);
  await supabase.from("pets").update({ daily_target_g: Math.round(totalDailyG) }).eq("id", pet.id);

  const { data: schedule, error: fetchError } = await supabase
    .from("feeding_schedule")
    .select("*")
    .eq("device_id", pet.device_id)
    .order("time_of_day", { ascending: true });

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  return NextResponse.json({ schedule: (schedule ?? []) as FeedingSchedule[] });
}
