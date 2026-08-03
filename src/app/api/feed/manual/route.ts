import { NextResponse } from "next/server";
import { DEVICE_ID, getPet } from "@/lib/device";
import { deviceStatusFromHealth, type DeviceHealthRpcResult } from "@/lib/device-status";
import { computeDispenseAmount, mealSlotForDate } from "@/lib/feeding-logic";
import { createClient } from "@/lib/supabase/server";

export async function POST() {
  try {
    const supabase = await createClient();
    const pet = await getPet(supabase);

    if (!pet) {
      return NextResponse.json(
        { error: "ไม่พบข้อมูลสัตว์เลี้ยง", errorCode: "PET_NOT_FOUND" },
        { status: 404 },
      );
    }

    if (pet.device_id !== DEVICE_ID) {
      console.warn("[feed/manual] pet is paired with a non-canonical device", {
        pet_device_id: pet.device_id,
      });
      return NextResponse.json(
        { error: "ไม่พบเครื่องให้อาหารที่ลงทะเบียน", errorCode: "DEVICE_NOT_FOUND" },
        { status: 409 },
      );
    }

    const { data: health, error: healthError } = await supabase.rpc("device_health", {
      p_device_id: DEVICE_ID,
    });
    if (healthError) {
      console.error("[feed/manual] device_health failed", { code: healthError.code });
      return NextResponse.json(
        { error: "ตรวจสอบสถานะเครื่องไม่ได้", errorCode: "DATABASE_ERROR" },
        { status: 503 },
      );
    }

    const healthResult = (health ?? {}) as DeviceHealthRpcResult;
    if (healthResult.exists !== true) {
      return NextResponse.json(
        { error: "ไม่พบเครื่อง PETFEEDER-001 ในระบบ", errorCode: "DEVICE_NOT_FOUND" },
        { status: 409 },
      );
    }

    const deviceStatus = deviceStatusFromHealth(DEVICE_ID, healthResult);
    if (!deviceStatus.online) {
      return NextResponse.json(
        {
          error: "เครื่องให้อาหารไม่ได้เชื่อมต่ออยู่ กรุณาตรวจสอบไฟ Wi-Fi หรือเฟิร์มแวร์",
          errorCode: "DEVICE_OFFLINE",
          reason: deviceStatus.reason,
        },
        { status: 409 },
      );
    }

    const { data: latestReading, error: readingError } = await supabase
      .from("feeder_readings")
      .select("tray_weight_g")
      .eq("device_id", DEVICE_ID)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (readingError) {
      console.error("[feed/manual] latest reading lookup failed", { code: readingError.code });
      return NextResponse.json(
        { error: "อ่านข้อมูลถาดอาหารไม่ได้", errorCode: "DATABASE_ERROR" },
        { status: 503 },
      );
    }

    const dispenseAmountG = computeDispenseAmount(
      pet.daily_target_g,
      latestReading?.tray_weight_g ?? 0,
    );

    const { data: command, error: enqueueError } = await supabase.rpc("enqueue_feed_command", {
      p_device_id: DEVICE_ID,
      p_target_g: dispenseAmountG,
      p_meal_slot: mealSlotForDate(new Date()),
    });

    if (enqueueError) {
      if (enqueueError.code === "54000") {
        return NextResponse.json(
          { error: "สั่งให้อาหารถี่เกินไป กรุณารอสักครู่แล้วลองใหม่", errorCode: "RATE_LIMITED" },
          { status: 429 },
        );
      }
      console.error("[feed/manual] enqueue failed", {
        device_id: DEVICE_ID,
        code: enqueueError.code,
        message: enqueueError.message,
      });
      return NextResponse.json(
        { error: "ไม่สามารถสร้างคำสั่งให้อาหารได้", errorCode: "COMMAND_ENQUEUE_FAILED" },
        { status: 503 },
      );
    }

    return NextResponse.json({ dispenseAmountG, command, errorCode: null }, { status: 202 });
  } catch (error) {
    console.error("[feed/manual] request failed", {
      device_id: DEVICE_ID,
      message: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json(
      { error: "ระบบให้อาหารขัดข้อง กรุณาลองใหม่", errorCode: "DATABASE_ERROR" },
      { status: 503 },
    );
  }
}