import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEVICE_ID, getPet } from "@/lib/device";

interface CreatePetBody {
  name?: string;
  weightKg?: number;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  let body: CreatePetBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const { name, weightKg } = body;

  if (!name || weightKg == null) {
    return NextResponse.json({ error: "name and weightKg are required" }, { status: 400 });
  }

  // Single-tenant app: at most one pet ever exists. Update it if present,
  // otherwise create it.
  const existing = await getPet(supabase);

  const query = existing
    ? supabase.from("pets").update({ name, weight_kg: weightKg }).eq("id", existing.id)
    : supabase.from("pets").insert({ device_id: DEVICE_ID, name, weight_kg: weightKg });

  const { data: pet, error } = await query.select().single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ pet }, { status: existing ? 200 : 201 });
}
