import { describe, expect, it } from "vitest";
import { ageFromBirthDate } from "./pet-age";

describe("ageFromBirthDate", () => {
  it("computes whole years and months elapsed", () => {
    expect(ageFromBirthDate("2024-01-15", new Date("2026-07-21"))).toEqual({
      years: 2,
      months: 6,
    });
  });

  it("borrows a month when the day-of-month hasn't been reached yet", () => {
    expect(ageFromBirthDate("2026-02-20", new Date("2027-01-15"))).toEqual({
      years: 0,
      months: 10,
    });
  });

  it("returns 0y 0m on the birth date itself", () => {
    expect(ageFromBirthDate("2026-07-21", new Date("2026-07-21"))).toEqual({
      years: 0,
      months: 0,
    });
  });

  it("rolls over to a full year on the birthday", () => {
    expect(ageFromBirthDate("2024-07-21", new Date("2026-07-21"))).toEqual({
      years: 2,
      months: 0,
    });
  });

  it("clamps to 0 for a birth date in the future", () => {
    expect(ageFromBirthDate("2026-12-01", new Date("2026-07-21"))).toEqual({
      years: 0,
      months: 0,
    });
  });
});
