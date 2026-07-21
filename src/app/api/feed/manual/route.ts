import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/device";
import { computeDispenseAmount } from "@/lib/feeding-logic";
import type { MealSlot } from "@/lib/types";

function currentMealSlot(): MealSlot {
  const hour = new Date().getHours();
  if (hour < 11) return "breakfast";
  if (hour < 17) return "lunch";
  return "dinner";
}

export async function POST() {
  const supabase = await createClient();
  const pet = await getPet(supabase);

  if (!pet) {
    return NextResponse.json({ error: "ไม่พบข้อมูลสัตว์เลี้ยง" }, { status: 404 });
  }

  const { data: latestReading } = await supabase
    .from("feeder_readings")
    .select("tray_weight_g")
    .eq("device_id", pet.device_id)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const dispenseAmountG = computeDispenseAmount(
    pet.daily_target_g,
    latestReading?.tray_weight_g ?? 0,
  );

  // TODO(hardware): this row records the commanded dispense amount with
  // actual_eaten_g = 0. Once the device measures the post-meal tray-weight
  // delta, it should update this row (or insert a follow-up feed_event) with
  // the real actual_eaten_g so the low-eating alert has data to compare against.
  const { data: feedEvent, error: insertError } = await supabase
    .from("feed_events")
    .insert({
      device_id: pet.device_id,
      meal_slot: currentMealSlot(),
      target_g: dispenseAmountG,
      actual_eaten_g: 0,
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ dispenseAmountG, feedEvent }, { status: 201 });
}
