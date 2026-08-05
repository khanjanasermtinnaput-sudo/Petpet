import { NextResponse } from "next/server";
import { ACTIVE_PET_COOKIE } from "@/lib/active-pet";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: { petId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }
  if (!body.petId) return NextResponse.json({ error: "petId is required" }, { status: 400 });

  const supabase = await createClient();
  const { data: pet } = await supabase.from("pets").select("id").eq("id", body.petId).maybeSingle();
  if (!pet) return NextResponse.json({ error: "pet not found" }, { status: 404 });

  const response = NextResponse.json({ petId: pet.id });
  response.cookies.set(ACTIVE_PET_COOKIE, pet.id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}