import { NextResponse } from "next/server";
import { DEVICE_ID, getPet } from "@/lib/device";
import { deviceStatusFromHealth, type DeviceHealthRpcResult } from "@/lib/device-status";
import { computeDispenseAmount, mealSlotForDate } from "@/lib/feeding-logic";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  const supabase = await createClient();
  const pet = await getPet(supabase);

  if (!pet) {
    return NextResponse.json({ error: "ไม่พบข้อมูลสัตว์เลี้ยง" }, { status: 404 });
  }

  if (pet.device_id !== DEVICE_ID) {
    console.warn("[feed/manual] pet is paired with a non-canonical device", {
      pet_device_id: pet.device_id,
    });
    return NextResponse.json({ error: "ไม่พบเครื่องให้อาหารที่ลงทะเบียน" }, { status: 409 });
  }

  const { data: health, error: healthError } = await supabase.rpc("device_health", {
    p_device_id: DEVICE_ID,
  });
  if (healthError) {
    console.error("[feed/manual] device_health failed", { code: healthError.code });
    return NextResponse.json({ error: "ตรวจสอบสถานะเครื่องไม่ได้" }, { status: 503 });
  }

  const healthResult = (health ?? {}) as DeviceHealthRpcResult;
  if (healthResult.exists !== true) {
    return NextResponse.json({ error: "ไม่พบเครื่อง PETFEEDER-001 ในระบบ" }, { status: 409 });
  }
  const deviceStatus = deviceStatusFromHealth(DEVICE_ID, healthResult);
  if (!deviceStatus.online) {
    return NextResponse.json(
      {
        error: "เครื่องให้อาหารไม่ได้เชื่อมต่ออยู่ กรุณาตรวจสอบไฟ Wi-Fi หรือเฟิร์มแวร์",
        reason: deviceStatus.reason,
      },
      { status: 409 },
    );
  }

  const { data: latestReading } = await supabase
    .from("feeder_readings")
    .select("tray_weight_g")
    .eq("device_id", DEVICE_ID)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const dispenseAmountG = computeDispenseAmount(
    pet.daily_target_g,
    latestReading?.tray_weight_g ?? 0,
  );

  const { data: command, error } = await supabase.rpc("enqueue_feed_command", {
    p_device_id: DEVICE_ID,
    p_target_g: dispenseAmountG,
    p_meal_slot: mealSlotForDate(new Date()),
  });

  if (error) {
    if (error.code === "54000") {
      return NextResponse.json(
        { error: "สั่งให้อาหารถี่เกินไป กรุณารอสักครู่แล้วลองใหม่" },
        { status: 429 },
      );
    }
    console.error("[feed/manual] enqueue failed", {
      device_id: DEVICE_ID,
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ error: "ไม่สามารถคิวคำสั่งให้อาหารได้" }, { status: 500 });
  }

  return NextResponse.json({ dispenseAmountG, command }, { status: 202 });
}