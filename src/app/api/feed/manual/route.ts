import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/device";
import { computeDispenseAmount, mealSlotForDate } from "@/lib/feeding-logic";

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

  // This route can no longer assert that a meal happened — only the feeder
  // knows whether food actually came out. It queues a command; the feed_event
  // is written by device_report_result() once the hardware reports back.
  //
  // The meal slot is decided here, at enqueue time, rather than when the
  // device executes: a command queued at 16:59 and dispensed at 17:03 belongs
  // to lunch, because that is when the human asked for it.
  const { data: command, error } = await supabase.rpc("enqueue_feed_command", {
    p_device_id: pet.device_id,
    p_target_g: dispenseAmountG,
    p_meal_slot: mealSlotForDate(new Date()),
  });

  if (error) {
    // enqueue_feed_command raises SQLSTATE 54000 when a device has been asked
    // to feed too often. That is a caller problem, not a server fault, so it
    // gets its own status and a message the user can act on.
    if (error.code === "54000") {
      return NextResponse.json(
        { error: "สั่งให้อาหารถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" },
        { status: 429 },
      );
    }
    console.error("[feed/manual] enqueue failed", {
      device_id: pet.device_id,
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // 202, not 201: the command is accepted, not carried out. The dashboard
  // waits on the realtime status change before it tells the user anything.
  return NextResponse.json({ dispenseAmountG, command }, { status: 202 });
}
