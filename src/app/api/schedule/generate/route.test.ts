import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Pet } from "@/lib/types";

const { mockGenerateContent, mockGetPet, mockCreateClient } = vi.hoisted(() => ({
  mockGenerateContent: vi.fn(),
  mockGetPet: vi.fn(),
  mockCreateClient: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn().mockImplementation(function GoogleGenAI() {
    return { models: { generateContent: mockGenerateContent } };
  }),
}));

vi.mock("@/lib/active-pet", () => ({ getPet: mockGetPet }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { POST } from "./route";

// Local copy of route.ts's SCHEDULE_SCHEMA (not exported by the route) so the
// "calls Gemini with the right config" test can assert against it without
// modifying production code.
const EXPECTED_SCHEDULE_SCHEMA = {
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

const fixturePet: Pet = {
  id: "pet-1",
  device_id: "device-1",
  name: "Milo",
  species: "Cat",
  breed: "siamese",
  weight_kg: 4.2,
  age_years: 1,
  age_months: 6,
  daily_target_g: 0,
  birth_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

// fixturePet is a 4.2kg cat, 1y6m old -> adult bucket, life_stage_factor 1.2.
// These numbers are formula-consistent (rer_kcal = 70 * 4.2^0.75, mer_kcal =
// rer_kcal * 1.2, daily_target_g = mer_kcal / 3.5) so the happy-path tests
// pass the new nutrition cross-check in route.ts, not just the meal-shape one.
const VALID_NUTRITION_REPORT = {
  rer_kcal: 205.4,
  life_stage_factor: 1.2,
  mer_kcal: 246.4,
  kcal_per_gram_assumed: 3.5,
  daily_target_g: 70.4,
};

const VALID_MEALS = [
  { meal_slot: "breakfast", time_of_day: "07:30", target_g: 23 },
  { meal_slot: "lunch", time_of_day: "12:30", target_g: 22 },
  { meal_slot: "dinner", time_of_day: "18:30", target_g: 25 },
];

function mockGeminiMeals(meals: unknown, nutrition: Record<string, unknown> = VALID_NUTRITION_REPORT) {
  mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ ...nutrition, meals }) });
}

interface SupabaseStubOptions {
  upsertError?: { message: string } | null;
  updateError?: { message: string } | null;
  selectResult?: { data: unknown[] | null; error: { message: string } | null };
}

function createSupabaseStub(opts: SupabaseStubOptions = {}) {
  const upsert = vi.fn().mockResolvedValue({ error: opts.upsertError ?? null });
  const update = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ error: opts.updateError ?? null }),
  }));
  const select = vi.fn(() => ({
    eq: vi.fn(() => ({
      order: vi.fn().mockResolvedValue(opts.selectResult ?? { data: [], error: null }),
    })),
  }));

  const from = vi.fn((table: string) => {
    if (table === "feeding_schedule") return { upsert, select };
    if (table === "pets") return { update };
    throw new Error(`unexpected table: ${table}`);
  });

  return { from, upsert, update, select };
}

describe("POST /api/schedule/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    mockGetPet.mockResolvedValue(fixturePet);
    mockCreateClient.mockResolvedValue(createSupabaseStub());
    mockGeminiMeals(VALID_MEALS);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("calls Gemini with the expected model, response format, and schema", async () => {
    await POST();

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    const call = mockGenerateContent.mock.calls[0][0];
    expect(call.model).toBe("gemini-2.5-flash");
    expect(call.config.responseMimeType).toBe("application/json");
    expect(call.config.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(call.config.responseSchema).toEqual(EXPECTED_SCHEDULE_SCHEMA);
  });

  it("upserts a valid 3-meal schedule and updates the pet's daily target", async () => {
    const stub = createSupabaseStub();
    mockCreateClient.mockResolvedValue(stub);

    const res = await POST();

    expect(stub.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ device_id: "device-1", pet_id: "pet-1", meal_slot: "breakfast", time_of_day: "07:30", target_g: 23, source: "ai" }),
        expect.objectContaining({ meal_slot: "lunch", time_of_day: "12:30", target_g: 22 }),
        expect.objectContaining({ meal_slot: "dinner", time_of_day: "18:30", target_g: 25 }),
      ]),
      { onConflict: "pet_id,meal_slot" },
    );
    expect(stub.update).toHaveBeenCalledWith({ daily_target_g: 70 });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ schedule: [] });
  });

  it("rejects with 502 when a meal slot is missing", async () => {
    const stub = createSupabaseStub();
    mockCreateClient.mockResolvedValue(stub);
    mockGeminiMeals(VALID_MEALS.filter((m) => m.meal_slot !== "dinner"));

    const res = await POST();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "AI ไม่สามารถวางแผนตารางอาหารที่ถูกต้องได้ กรุณาลองใหม่" });
    expect(stub.upsert).not.toHaveBeenCalled();
  });

  it("rejects with 502 when time_of_day doesn't match HH:MM", async () => {
    const stub = createSupabaseStub();
    mockCreateClient.mockResolvedValue(stub);
    mockGeminiMeals([
      { meal_slot: "breakfast", time_of_day: "7:30", target_g: 40 },
      { meal_slot: "lunch", time_of_day: "24:00", target_g: 35 },
      { meal_slot: "dinner", time_of_day: "18:30", target_g: 45 },
    ]);

    const res = await POST();

    expect(res.status).toBe(502);
    expect(stub.upsert).not.toHaveBeenCalled();
  });

  it.each([0, -5, "forty"])("rejects with 502 when target_g is %s", async (badValue) => {
    const stub = createSupabaseStub();
    mockCreateClient.mockResolvedValue(stub);
    mockGeminiMeals([
      { meal_slot: "breakfast", time_of_day: "07:30", target_g: badValue },
      { meal_slot: "lunch", time_of_day: "12:30", target_g: 35 },
      { meal_slot: "dinner", time_of_day: "18:30", target_g: 45 },
    ]);

    const res = await POST();

    expect(res.status).toBe(502);
    expect(stub.upsert).not.toHaveBeenCalled();
  });

  it("keeps the last entry when Gemini returns a duplicate meal_slot", async () => {
    const stub = createSupabaseStub();
    mockCreateClient.mockResolvedValue(stub);
    mockGeminiMeals([
      { meal_slot: "breakfast", time_of_day: "06:00", target_g: 5 },
      { meal_slot: "breakfast", time_of_day: "07:30", target_g: 23 },
      { meal_slot: "lunch", time_of_day: "12:30", target_g: 22 },
      { meal_slot: "dinner", time_of_day: "18:30", target_g: 25 },
    ]);

    const res = await POST();

    expect(res.status).toBe(200);
    expect(stub.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ meal_slot: "breakfast", time_of_day: "07:30", target_g: 23 })]),
      { onConflict: "pet_id,meal_slot" },
    );
  });

  it("returns 502 without leaking details when Gemini rejects", async () => {
    mockGenerateContent.mockRejectedValue(new Error("upstream network error with sensitive detail"));

    const res = await POST();

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).not.toContain("sensitive detail");
    expect(body).toEqual({ error: "AI ไม่สามารถวางแผนตารางอาหารที่ถูกต้องได้ กรุณาลองใหม่" });
  });

  it("returns 502 when response.text is missing", async () => {
    mockGenerateContent.mockResolvedValue({ text: undefined });

    const res = await POST();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "AI ไม่สามารถวางแผนตารางอาหารที่ถูกต้องได้ กรุณาลองใหม่" });
  });

  it("returns 502 without leaking raw text when Gemini's JSON is truncated", async () => {
    mockGenerateContent.mockResolvedValue({ text: '{"meals": [{"meal_slot": "breakfast", "time_of_day"' });

    const res = await POST();

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).not.toContain("meal_slot");
    expect(body).toEqual({ error: "AI ไม่สามารถวางแผนตารางอาหารที่ถูกต้องได้ กรุณาลองใหม่" });
  });

  it("returns 500 and never calls Gemini when GEMINI_API_KEY is missing", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");

    const res = await POST();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์" });
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns 404 and never calls Gemini when no pet is found", async () => {
    mockGetPet.mockResolvedValue(null);

    const res = await POST();

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "ไม่พบข้อมูลสัตว์เลี้ยง" });
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it("returns 500 with the raw Supabase error when the upsert fails", async () => {
    const stub = createSupabaseStub({ upsertError: { message: "duplicate key value" } });
    mockCreateClient.mockResolvedValue(stub);

    const res = await POST();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "duplicate key value" });
    expect(stub.update).not.toHaveBeenCalled();
  });

  it("returns 500 with the raw Supabase error when the final select fails", async () => {
    const stub = createSupabaseStub({ selectResult: { data: null, error: { message: "connection reset" } } });
    mockCreateClient.mockResolvedValue(stub);

    const res = await POST();

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "connection reset" });
  });

  it("still returns the schedule successfully even if the daily_target_g update errors", async () => {
    const stub = createSupabaseStub({ updateError: { message: "should be ignored" } });
    mockCreateClient.mockResolvedValue(stub);

    const res = await POST();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ schedule: [] });
  });

  it("rejects with 502 when rer_kcal doesn't match the pet's weight-based RER formula", async () => {
    const stub = createSupabaseStub();
    mockCreateClient.mockResolvedValue(stub);
    mockGeminiMeals(VALID_MEALS, { ...VALID_NUTRITION_REPORT, rer_kcal: 500 });

    const res = await POST();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: "AI ไม่สามารถวางแผนตารางอาหารที่ถูกต้องได้ กรุณาลองใหม่" });
    expect(stub.upsert).not.toHaveBeenCalled();
  });

  it("rejects with 502 when life_stage_factor doesn't match the pet's species/age bucket", async () => {
    const stub = createSupabaseStub();
    mockCreateClient.mockResolvedValue(stub);
    // 2.0 is a dog-growth multiplier, not valid for this adult cat fixture.
    mockGeminiMeals(VALID_MEALS, { ...VALID_NUTRITION_REPORT, life_stage_factor: 2.0 });

    const res = await POST();

    expect(res.status).toBe(502);
    expect(stub.upsert).not.toHaveBeenCalled();
  });

  it("rejects with 502 when mer_kcal is inconsistent with rer_kcal x life_stage_factor", async () => {
    const stub = createSupabaseStub();
    mockCreateClient.mockResolvedValue(stub);
    mockGeminiMeals(VALID_MEALS, { ...VALID_NUTRITION_REPORT, mer_kcal: 400 });

    const res = await POST();

    expect(res.status).toBe(502);
    expect(stub.upsert).not.toHaveBeenCalled();
  });

  it("rejects with 502 when kcal_per_gram_assumed differs from the fixed 3.5 constant", async () => {
    const stub = createSupabaseStub();
    mockCreateClient.mockResolvedValue(stub);
    mockGeminiMeals(VALID_MEALS, { ...VALID_NUTRITION_REPORT, kcal_per_gram_assumed: 5 });

    const res = await POST();

    expect(res.status).toBe(502);
    expect(stub.upsert).not.toHaveBeenCalled();
  });

  it("rejects with 502 when daily_target_g is inconsistent with mer_kcal / kcal_per_gram_assumed", async () => {
    const stub = createSupabaseStub();
    mockCreateClient.mockResolvedValue(stub);
    mockGeminiMeals(VALID_MEALS, { ...VALID_NUTRITION_REPORT, daily_target_g: 500 });

    const res = await POST();

    expect(res.status).toBe(502);
    expect(stub.upsert).not.toHaveBeenCalled();
  });

  it("rejects with 502 when the meals total diverges from the reported daily_target_g", async () => {
    const stub = createSupabaseStub();
    mockCreateClient.mockResolvedValue(stub);
    mockGeminiMeals([
      { meal_slot: "breakfast", time_of_day: "07:30", target_g: 23 },
      { meal_slot: "lunch", time_of_day: "12:30", target_g: 22 },
      { meal_slot: "dinner", time_of_day: "18:30", target_g: 200 },
    ]);

    const res = await POST();

    expect(res.status).toBe(502);
    expect(stub.upsert).not.toHaveBeenCalled();
  });
});
