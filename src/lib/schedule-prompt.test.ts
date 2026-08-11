import { describe, expect, it } from "vitest";
import { buildSchedulePrompt } from "./schedule-prompt";

describe("buildSchedulePrompt", () => {
  it("adds breed as supporting, not primary, feeding context", () => {
    const prompt = buildSchedulePrompt({ species: "Cat", breed: "siamese", weight_kg: 4, age_years: 1, age_months: 6 });
    expect(prompt).toContain("สายพันธุ์: Siamese");
    expect(prompt).toContain("ชนิด น้ำหนัก อายุ");
    expect(prompt).toContain("ห้ามสรุปปริมาณอาหารที่แน่นอนจากสายพันธุ์เพียงอย่างเดียว");
  });

  it("keeps legacy pets without a breed safe", () => {
    expect(buildSchedulePrompt({ species: "Dog", breed: null, weight_kg: 8, age_years: 3, age_months: 0 })).toContain("สายพันธุ์: ไม่ระบุ");
  });
});
