import { NextResponse } from "next/server";
import { DEVICE_ID } from "@/lib/device";
import { getPet } from "@/lib/active-pet";
import { deviceStatusFromHealth, type DeviceHealthRpcResult } from "@/lib/device-status";
import { feedCommandRpcArgs, isFeedSchemaOutOfDate } from "@/lib/feeder-commands";
import { computeDispenseAmount, mealSlotForDate } from "@/lib/feeding-logic";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const startedAt = Date.now();
  const requestId = request.headers.get("x-vercel-id");
  console.log(JSON.stringify({
    level: "info",
    message: "feed command request started",
    route: "/api/feed/manual",
    requestId,
  }));

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

    const { data: command, error: enqueueError } = await supabase.rpc(
      "enqueue_feed_command",
      feedCommandRpcArgs(
        DEVICE_ID,
        pet.id,
        dispenseAmountG,
        mealSlotForDate(new Date()),
      ),
    );

    if (enqueueError) {
      if (enqueueError.code === "54000") {
        return NextResponse.json(
          { error: "สั่งให้อาหารถี่เกินไป กรุณารอสักครู่แล้วลองใหม่", errorCode: "RATE_LIMITED" },
          { status: 429 },
        );
      }
      const schemaOutOfDate = isFeedSchemaOutOfDate(enqueueError);
      console.error(JSON.stringify({
        level: "error",
        message: "feed command enqueue failed",
        route: "/api/feed/manual",
        requestId,
        deviceId: DEVICE_ID,
        databaseCode: enqueueError.code,
        errorCode: schemaOutOfDate ? "SCHEMA_OUT_OF_DATE" : "COMMAND_ENQUEUE_FAILED",
        durationMs: Date.now() - startedAt,
      }));

      if (schemaOutOfDate) {
        return NextResponse.json(
          {
            error: "ฐานข้อมูลเครื่องให้อาหารยังไม่ได้อัปเดต กรุณารัน migration ล่าสุด",
            errorCode: "SCHEMA_OUT_OF_DATE",
          },
          { status: 503 },
        );
      }
      return NextResponse.json(
        { error: "ไม่สามารถสร้างคำสั่งให้อาหารได้", errorCode: "COMMAND_ENQUEUE_FAILED" },
        { status: 503 },
      );
    }

    console.log(JSON.stringify({
      level: "info",
      message: "feed command enqueued",
      route: "/api/feed/manual",
      requestId,
      deviceId: DEVICE_ID,
      commandId: command.id,
      durationMs: Date.now() - startedAt,
    }));
    return NextResponse.json({ dispenseAmountG, command, errorCode: null }, { status: 202 });
  } catch (error) {
    console.error(JSON.stringify({
      level: "error",
      message: "feed command request failed",
      route: "/api/feed/manual",
      requestId,
      deviceId: DEVICE_ID,
      error: error instanceof Error ? error.message : "unknown error",
      durationMs: Date.now() - startedAt,
    }));
    return NextResponse.json(
      { error: "ระบบให้อาหารขัดข้อง กรุณาลองใหม่", errorCode: "DATABASE_ERROR" },
      { status: 503 },
    );
  }
}
