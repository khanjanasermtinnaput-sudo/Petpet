import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEVICE_ID } from "@/lib/device";
import { ACTIVE_PET_COOKIE } from "@/lib/active-pet";
import { ageFromBirthDate } from "@/lib/pet-age";

interface PetBody {
  petId?: string;
  name?: string;
  species?: string;
  birthDate?: string;
  weightKg?: number;
}

const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function POST(request: Request) {
  const supabase = await createClient();
  let body: PetBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { petId, name, species, birthDate, weightKg } = body;
  if (!name || !species || !birthDate || weightKg == null) {
    return NextResponse.json(
      { error: "name, species, birthDate, and weightKg are required" },
      { status: 400 },
    );
  }
  if (!BIRTH_DATE_PATTERN.test(birthDate) || Number.isNaN(new Date(birthDate).getTime())) {
    return NextResponse.json({ error: "birthDate must be a valid YYYY-MM-DD date" }, { status: 400 });
  }

  const { years: age_years, months: age_months } = ageFromBirthDate(birthDate);
  const petFields = { name, species, birth_date: birthDate, age_years, age_months, weight_kg: weightKg };
  const query = petId
    ? supabase.from("pets").update(petFields).eq("id", petId)
    : supabase.from("pets").insert({ device_id: DEVICE_ID, ...petFields });
  const { data: pet, error } = await query.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const response = NextResponse.json({ pet }, { status: petId ? 200 : 201 });
  response.cookies.set(ACTIVE_PET_COOKIE, pet.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}