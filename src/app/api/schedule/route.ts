import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/device";
import type { FeedingSchedule } from "@/lib/types";

export async function GET() {
  const supabase = await createClient();
  const pet = await getPet(supabase);

  if (!pet) {
    return NextResponse.json({ error: "ไม่พบข้อมูลสัตว์เลี้ยง" }, { status: 404 });
  }

  const { data: schedule, error } = await supabase
    .from("feeding_schedule")
    .select("*")
    .eq("device_id", pet.device_id)
    .order("time_of_day", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ schedule: (schedule ?? []) as FeedingSchedule[] });
}
