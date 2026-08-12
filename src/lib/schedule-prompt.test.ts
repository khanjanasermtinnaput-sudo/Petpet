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

  it("passes through a species that isn't Cat or Dog verbatim", () => {
    const prompt = buildSchedulePrompt({ species: "Rabbit", breed: "mixed_breed", weight_kg: 2, age_years: 1, age_months: 0 });
    expect(prompt).toContain("ชนิด: Rabbit");
    expect(prompt).toContain("สายพันธุ์: ไม่ระบุ");
  });

  it("keeps decimal weight precise, not rounded", () => {
    const prompt = buildSchedulePrompt({ species: "Cat", breed: null, weight_kg: 2.35, age_years: 1, age_months: 0 });
    expect(prompt).toContain("น้ำหนัก: 2.35 กก.");
  });

  it("handles a pet that is 0 years 0 months old", () => {
    const prompt = buildSchedulePrompt({ species: "Dog", breed: null, weight_kg: 1.2, age_years: 0, age_months: 0 });
    expect(prompt).toContain("อายุ: 0 ปี 0 เดือน");
  });

  it("spells out the RER formula and the fixed kcal-per-gram constant", () => {
    const prompt = buildSchedulePrompt({ species: "Cat", breed: null, weight_kg: 4.2, age_years: 1, age_months: 6 });
    expect(prompt).toContain("RER = 70 × (น้ำหนักตัวเป็นกิโลกรัม) ^ 0.75");
    expect(prompt).toContain("MER = RER ×");
    expect(prompt).toContain("3.5 kcal");
  });

  it("renders the dog life-stage table for a dog, not the cat one", () => {
    const prompt = buildSchedulePrompt({ species: "Dog", breed: null, weight_kg: 10, age_years: 3, age_months: 0 });
    expect(prompt).toContain("สุนัขสูงวัย อายุ 7 ปีขึ้นไป");
    expect(prompt).not.toContain("แมวสูงวัย");
  });

  it("renders the cat life-stage table for a cat, not the dog one", () => {
    const prompt = buildSchedulePrompt({ species: "Cat", breed: null, weight_kg: 4, age_years: 3, age_months: 0 });
    expect(prompt).toContain("แมวสูงวัย อายุ 10 ปีขึ้นไป");
    expect(prompt).not.toContain("สุนัขสูงวัย");
  });
});
