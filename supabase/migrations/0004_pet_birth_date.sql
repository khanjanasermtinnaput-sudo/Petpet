-- Onboarding now collects the pet's birth date so age_years/age_months
-- (already used by the AI schedule generator and vet chat prompts) reflect
-- reality instead of always defaulting to 0.
alter table pets add column if not exists birth_date date;
