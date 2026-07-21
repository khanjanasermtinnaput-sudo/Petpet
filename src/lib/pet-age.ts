/**
 * Age in whole years/months as of `today`, given an ISO birth date
 * (`YYYY-MM-DD`). Borrows a month when `today`'s day-of-month hasn't
 * reached the birth day yet, so e.g. born 2026-02-20 is 0y 11m on
 * 2027-01-15, not 0y 12m.
 */
export function ageFromBirthDate(
  birthDateIso: string,
  today: Date = new Date(),
): { years: number; months: number } {
  const birth = new Date(birthDateIso);

  if (birth > today) return { years: 0, months: 0 };

  let years = today.getFullYear() - birth.getFullYear();
  let months = today.getMonth() - birth.getMonth();

  if (today.getDate() < birth.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    years -= 1;
    months += 12;
  }

  return { years, months };
}
