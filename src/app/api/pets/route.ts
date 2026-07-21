import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface CreatePetBody {
  deviceId?: string;
  name?: string;
  species?: string;
  ageYears?: number;
  ageMonths?: number;
  weightKg?: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: CreatePetBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { deviceId, name, species, ageYears, ageMonths, weightKg } = body;

  if (!deviceId || !name || !species || weightKg == null) {
    return NextResponse.json(
      { error: "deviceId, name, species, and weightKg are required" },
      { status: 400 },
    );
  }

  const { error: deviceError } = await supabase
    .from("devices")
    .insert({ device_id: deviceId, user_id: user.id });

  if (deviceError) {
    const isUniqueViolation = deviceError.code === "23505";
    if (!isUniqueViolation) {
      return NextResponse.json({ error: deviceError.message }, { status: 500 });
    }

    // RLS only lets us see devices we own, so a null result here means the
    // serial is already claimed by a different account.
    const { data: ownDevice } = await supabase
      .from("devices")
      .select("device_id")
      .eq("device_id", deviceId)
      .maybeSingle();

    if (!ownDevice) {
      return NextResponse.json(
        { error: "อุปกรณ์นี้ถูกลงทะเบียนแล้วโดยบัญชีอื่น" },
        { status: 409 },
      );
    }
  }

  const { data: pet, error: petError } = await supabase
    .from("pets")
    .insert({
      user_id: user.id,
      device_id: deviceId,
      name,
      species,
      age_years: ageYears ?? 0,
      age_months: ageMonths ?? 0,
      weight_kg: weightKg,
    })
    .select()
    .single();

  if (petError) {
    return NextResponse.json({ error: petError.message }, { status: 500 });
  }

  return NextResponse.json({ pet }, { status: 201 });
}
