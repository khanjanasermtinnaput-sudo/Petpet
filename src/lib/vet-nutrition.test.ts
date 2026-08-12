import { describe, expect, it } from "vitest";
import {
  checkReportedNutrition,
  computeExpectedNutrition,
  computeRerKcal,
  KCAL_PER_GRAM_DEFAULT,
  lifeStageBucketFor,
  renderLifeStageTableTh,
} from "./vet-nutrition";

describe("computeRerKcal", () => {
  it("computes RER = 70 * weight^0.75", () => {
    expect(computeRerKcal(1)).toBeCloseTo(70, 5);
    expect(computeRerKcal(4.2)).toBeCloseTo(205.4, 0);
    expect(computeRerKcal(25)).toBeCloseTo(782.6, 0);
  });
});

describe("lifeStageBucketFor — Dog boundaries", () => {
  it("classifies growth under 4 months", () => {
    expect(lifeStageBucketFor("Dog", 0, 3).factor).toBe(3.0);
  });
  it("classifies exactly 4 months as the 4-12mo growth bucket", () => {
    expect(lifeStageBucketFor("Dog", 0, 4).factor).toBe(2.0);
  });
  it("classifies 11 months as still growth", () => {
    expect(lifeStageBucketFor("Dog", 0, 11).factor).toBe(2.0);
  });
  it("classifies exactly 12 months (1y0m) as adult", () => {
    expect(lifeStageBucketFor("Dog", 1, 0).factor).toBe(1.6);
  });
  it("classifies 6y11m as still adult", () => {
    expect(lifeStageBucketFor("Dog", 6, 11).factor).toBe(1.6);
  });
  it("classifies exactly 7y0m (84 months) as senior", () => {
    expect(lifeStageBucketFor("Dog", 7, 0).factor).toBe(1.4);
  });
  it("classifies 10y0m as senior", () => {
    expect(lifeStageBucketFor("Dog", 10, 0).factor).toBe(1.4);
  });
});

describe("lifeStageBucketFor — Cat boundaries", () => {
  it("classifies growth under 4 months", () => {
    expect(lifeStageBucketFor("Cat", 0, 3).factor).toBe(3.0);
  });
  it("classifies exactly 4 months as the 4-12mo growth bucket", () => {
    expect(lifeStageBucketFor("Cat", 0, 4).factor).toBe(2.5);
  });
  it("classifies 11 months as still growth", () => {
    expect(lifeStageBucketFor("Cat", 0, 11).factor).toBe(2.5);
  });
  it("classifies exactly 12 months (1y0m) as adult", () => {
    expect(lifeStageBucketFor("Cat", 1, 0).factor).toBe(1.2);
  });
  it("classifies 9y11m as still adult", () => {
    expect(lifeStageBucketFor("Cat", 9, 11).factor).toBe(1.2);
  });
  it("classifies exactly 10y0m (120 months) as senior", () => {
    expect(lifeStageBucketFor("Cat", 10, 0).factor).toBe(1.1);
  });
  it("classifies 15y0m as senior", () => {
    expect(lifeStageBucketFor("Cat", 15, 0).factor).toBe(1.1);
  });
});

describe("lifeStageBucketFor — non-Cat/Dog fallback", () => {
  it("uses the generic fallback factor regardless of age", () => {
    expect(lifeStageBucketFor("Rabbit", 2, 0).factor).toBe(1.6);
    expect(lifeStageBucketFor("Hamster", 0, 1).factor).toBe(1.6);
  });
});

describe("renderLifeStageTableTh", () => {
  it("renders only dog labels for Dog", () => {
    const table = renderLifeStageTableTh("Dog");
    expect(table).toContain("ลูกสุนัขอายุต่ำกว่า 4 เดือน");
    expect(table).toContain("สุนัขสูงวัย อายุ 7 ปีขึ้นไป");
    expect(table).not.toContain("แมว");
  });

  it("renders only cat labels for Cat", () => {
    const table = renderLifeStageTableTh("Cat");
    expect(table).toContain("ลูกแมวอายุต่ำกว่า 4 เดือน");
    expect(table).toContain("แมวสูงวัย อายุ 10 ปีขึ้นไป");
    expect(table).not.toContain("สุนัข");
  });

  it("renders the fallback caveat for other species", () => {
    expect(renderLifeStageTableTh("Rabbit")).toContain("เป็นค่าประมาณคร่าวๆ");
  });
});

describe("computeExpectedNutrition", () => {
  it("derives mer and daily grams from rer and the matched factor", () => {
    const pet = { species: "Cat", weight_kg: 4.2, age_years: 1, age_months: 6 };
    const result = computeExpectedNutrition(pet);
    expect(result.lifeStageFactor).toBe(1.2);
    expect(result.merKcal).toBeCloseTo(result.rerKcal * 1.2, 5);
    expect(result.kcalPerGramAssumed).toBe(KCAL_PER_GRAM_DEFAULT);
    expect(result.dailyTargetG).toBeCloseTo(result.merKcal / KCAL_PER_GRAM_DEFAULT, 5);
  });
});

describe("checkReportedNutrition", () => {
  const pet = { species: "Cat", weight_kg: 4.2, age_years: 1, age_months: 6 };
  const expected = computeExpectedNutrition(pet);
  const validReport = {
    rer_kcal: expected.rerKcal,
    life_stage_factor: expected.lifeStageFactor,
    mer_kcal: expected.merKcal,
    kcal_per_gram_assumed: expected.kcalPerGramAssumed,
    daily_target_g: expected.dailyTargetG,
  };

  it("passes for a self-consistent, formula-matching report", () => {
    const result = checkReportedNutrition(pet, validReport, expected.dailyTargetG);
    expect(result).toEqual({ ok: true, failures: [] });
  });

  it("fails when rer_kcal is far from the weight-based formula", () => {
    const result = checkReportedNutrition(pet, { ...validReport, rer_kcal: 500 }, expected.dailyTargetG);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes("rer_kcal"))).toBe(true);
  });

  it("fails when life_stage_factor doesn't match the species/age bucket", () => {
    const result = checkReportedNutrition(pet, { ...validReport, life_stage_factor: 2.0 }, expected.dailyTargetG);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes("life_stage_factor"))).toBe(true);
  });

  it("fails when mer_kcal is inconsistent with rer_kcal x life_stage_factor", () => {
    const result = checkReportedNutrition(pet, { ...validReport, mer_kcal: 400 }, expected.dailyTargetG);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes("mer_kcal"))).toBe(true);
  });

  it("fails when kcal_per_gram_assumed differs from the fixed constant", () => {
    const result = checkReportedNutrition(pet, { ...validReport, kcal_per_gram_assumed: 5 }, expected.dailyTargetG);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes("kcal_per_gram_assumed"))).toBe(true);
  });

  it("fails when daily_target_g is inconsistent with mer_kcal / kcal_per_gram_assumed", () => {
    const result = checkReportedNutrition(pet, { ...validReport, daily_target_g: 500 }, expected.dailyTargetG);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes("daily_target_g"))).toBe(true);
  });

  it("fails when the meals sum diverges from the reported daily_target_g", () => {
    const result = checkReportedNutrition(pet, validReport, expected.dailyTargetG + 100);
    expect(result.ok).toBe(false);
    expect(result.failures.some((f) => f.includes("meals sum"))).toBe(true);
  });

  it("fails when a field is missing, non-numeric, or non-positive", () => {
    expect(checkReportedNutrition(pet, { ...validReport, rer_kcal: -1 }, expected.dailyTargetG).ok).toBe(false);
    expect(checkReportedNutrition(pet, { ...validReport, mer_kcal: NaN }, expected.dailyTargetG).ok).toBe(false);
    expect(
      checkReportedNutrition(pet, { ...validReport, daily_target_g: "70" as unknown as number }, expected.dailyTargetG).ok,
    ).toBe(false);
  });
});
