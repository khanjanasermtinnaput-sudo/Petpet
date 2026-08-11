import { describe, expect, it } from "vitest";
import { buildVetSystemPrompt, conversationTitle, isUuid } from "./vet-chat";

describe("VET AI chat helpers", () => {
  it("generates a deterministic, bounded conversation title", () => {
    expect(conversationTitle("  น้องไม่ยอมกินอาหารวันนี้   ต้องทำยังไง  ")).toBe("น้องไม่ยอมกินอาหารวันนี้ ต้องทำยังไง");
    expect(conversationTitle("a".repeat(45))).toBe(`${"a".repeat(44)}...`);
  });

  it("puts breed in the VET AI context without fabricating missing data", () => {
    const prompt = buildVetSystemPrompt({
      name: "โมจิ",
      species: "Dog",
      breed: "golden_retriever",
      age_years: 2,
      age_months: 3,
      weight_kg: 20,
      daily_target_g: 280,
    }, "ไม่มีข้อมูล");
    expect(prompt).toContain("สายพันธุ์: Golden Retriever");
    expect(buildVetSystemPrompt({
      name: "โมจิ", species: "Dog", breed: null, age_years: 2, age_months: 3, weight_kg: 20, daily_target_g: 280,
    }, "ไม่มีข้อมูล")).toContain("สายพันธุ์: ไม่ระบุ");
  });

  it("accepts only UUIDs for idempotency and conversation identifiers", () => {
    expect(isUuid("123e4567-e89b-42d3-a456-426614174000")).toBe(true);
    expect(isUuid("not-a-uuid")).toBe(false);
  });
});
