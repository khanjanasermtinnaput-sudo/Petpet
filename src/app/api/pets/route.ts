import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEVICE_ID } from "@/lib/device";
import { ACTIVE_PET_COOKIE } from "@/lib/active-pet";
import { ageFromBirthDate } from "@/lib/pet-age";
import { isBreedForSpecies, isPetSpecies } from "@/lib/pet-breeds";

interface PetBody {
  petId?: string;
  name?: string;
  species?: string;
  birthDate?: string;
  weightKg?: number;
  breed?: string | null;
}

const BIRTH_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const supabase = await createClient();
  let body: PetBody;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "JSON body must be an object" }, { status: 400 });
    }
    body = parsed as PetBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { petId, name, species, birthDate, weightKg, breed } = body;
  if (typeof name !== "string" || !isPetSpecies(species) || typeof birthDate !== "string" || typeof weightKg !== "number") {
    return NextResponse.json(
      { error: "name, species, birthDate, and weightKg are required" },
      { status: 400 },
    );
  }
  const normalizedName = name.trim();
  if (!normalizedName || normalizedName.length > 100) {
    return NextResponse.json({ error: "name must be between 1 and 100 characters" }, { status: 400 });
  }
  const parsedDate = new Date(`${birthDate}T00:00:00.000Z`);
  if (!BIRTH_DATE_PATTERN.test(birthDate) || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== birthDate || birthDate > new Date().toISOString().slice(0, 10)) {
    return NextResponse.json({ error: "birthDate must be a valid YYYY-MM-DD date" }, { status: 400 });
  }
  if (!Number.isFinite(weightKg) || weightKg <= 0 || weightKg > 200) {
    return NextResponse.json({ error: "weightKg must be a positive number up to 200" }, { status: 400 });
  }
  if (breed !== undefined && breed !== null && (typeof breed !== "string" || !isBreedForSpecies(species, breed))) {
    return NextResponse.json({ error: "breed must belong to the selected species" }, { status: 400 });
  }
  if (petId !== undefined && (typeof petId !== "string" || !UUID_PATTERN.test(petId))) {
    return NextResponse.json({ error: "petId must be a UUID" }, { status: 400 });
  }

  const { years: age_years, months: age_months } = ageFromBirthDate(birthDate);
  let resolvedBreed: string | null = breed ?? null;
  if (petId) {
    const { data: existingPet, error: existingError } = await supabase
      .from("pets")
      .select("species, breed")
      .eq("id", petId)
      .maybeSingle();
    if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });
    if (!existingPet) return NextResponse.json({ error: "pet not found" }, { status: 404 });
    if (breed === undefined) {
      resolvedBreed = existingPet.species === species ? existingPet.breed : null;
    }
  }
  const petFields = {
    name: normalizedName,
    species,
    breed: resolvedBreed,
    birth_date: birthDate,
    age_years,
    age_months,
    weight_kg: weightKg,
  };
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
