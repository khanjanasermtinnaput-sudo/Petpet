import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEVICE_ID, getPet } from "@/lib/device";
import { ageFromBirthDate } from "@/lib/pet-age";

interface CreatePetBody {
  name?: string;
  species?: string;
  breed?: string;
  birthDate?: string;
  weightKg?: number;
}

const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const supabase = await createClient();

  let body: CreatePetBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { name, species, breed, birthDate, weightKg } = body;
  if (!name || !species || !breed || !birthDate || weightKg == null) {
    return NextResponse.json(
      { error: "name, species, breed, birthDate, and weightKg are required" },
      { status: 400 },
    );
  }

  if (!BIRTH_DATE_PATTERN.test(birthDate) || Number.isNaN(new Date(birthDate).getTime())) {
    return NextResponse.json({ error: "birthDate must be a valid YYYY-MM-DD date" }, { status: 400 });
  }
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return NextResponse.json({ error: "weightKg must be greater than zero" }, { status: 400 });
  }

  const { years: age_years, months: age_months } = ageFromBirthDate(birthDate);
  const existing = await getPet(supabase);
  const petFields = { name, species, breed, birth_date: birthDate, age_years, age_months, weight_kg: weightKg };
  const query = existing
    ? supabase.from("pets").update(petFields).eq("id", existing.id)
    : supabase.from("pets").insert({ device_id: DEVICE_ID, ...petFields });

  const { data: pet, error } = await query.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ pet }, { status: existing ? 200 : 201 });
}
