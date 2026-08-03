import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deviceStatusFromHealth, type DeviceHealthRpcResult } from "@/lib/device-status";
import { DEVICE_ID, getPet } from "@/lib/device";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { uvOn?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (typeof body.uvOn !== "boolean") {
    return NextResponse.json({ error: "uvOn must be a boolean" }, { status: 400 });
  }

  const supabase = await createClient();
  const pet = await getPet(supabase);
  if (!pet || pet.device_id !== DEVICE_ID) {
    return NextResponse.json({ error: "ไม่พบเครื่องให้อาหาร" }, { status: 404 });
  }

  const { data: health, error: healthError } = await supabase.rpc("device_health", {
    p_device_id: DEVICE_ID,
  });
  if (healthError) return NextResponse.json({ error: "ตรวจสอบสถานะเครื่องไม่สำเร็จ" }, { status: 503 });

  const deviceStatus = deviceStatusFromHealth(DEVICE_ID, (health ?? {}) as DeviceHealthRpcResult);
  if (!deviceStatus.online) {
    return NextResponse.json({ error: "เครื่องยังไม่เชื่อมต่อ" }, { status: 409 });
  }

  const { data: command, error } = await supabase.rpc("enqueue_uv_command", {
    p_device_id: DEVICE_ID,
    p_uv_on: body.uvOn,
  });
  if (error) {
    if (error.code === "55000") {
      return NextResponse.json({ error: "เครื่องกำลังทำงานคำสั่งอื่นอยู่" }, { status: 409 });
    }
    return NextResponse.json({ error: "สร้างคำสั่ง UV ไม่สำเร็จ" }, { status: 503 });
  }

  return NextResponse.json({ command }, { status: 202 });
}
