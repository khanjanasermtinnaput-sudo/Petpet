import { NextResponse } from "next/server";
import {
  LAUNCHER_DEVICE_ID,
  launcherHealthFromRpc,
  launcherRpcArgs,
  validateLaunchParams,
} from "@/lib/launcher-commands";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Queues one launch drill for the shuttle launcher. */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "ข้อมูลที่ส่งมาไม่ใช่ JSON", errorCode: "INVALID_BODY" },
      { status: 400 },
    );
  }

  const parsed = validateLaunchParams(body);
  if (!parsed.ok) {
    return NextResponse.json(
      { error: parsed.message, errorCode: "INVALID_PARAMS", field: parsed.field },
      { status: 400 },
    );
  }

  try {
    const supabase = await createClient();

    const { data: rawHealth, error: healthError } = await supabase.rpc("launcher_health", {
      p_device_id: LAUNCHER_DEVICE_ID,
    });
    if (healthError) {
      console.error("[launcher/command] launcher_health failed", { code: healthError.code });
      return NextResponse.json(
        { error: "ตรวจสอบสถานะเครื่องยิงไม่ได้", errorCode: "DATABASE_ERROR" },
        { status: 503 },
      );
    }

    const health = launcherHealthFromRpc(rawHealth);
    if (!health.exists) {
      return NextResponse.json(
        { error: `ไม่พบเครื่อง ${LAUNCHER_DEVICE_ID} ในระบบ`, errorCode: "DEVICE_NOT_FOUND" },
        { status: 409 },
      );
    }
    // Never queue a launch for a machine that is not listening: the command
    // would sit pending and could fire minutes later when it reconnects.
    if (!health.online) {
      return NextResponse.json(
        { error: "เครื่องยิงไม่ได้เชื่อมต่ออยู่", errorCode: "DEVICE_OFFLINE" },
        { status: 409 },
      );
    }

    const { data: command, error } = await supabase.rpc(
      "enqueue_launcher_command",
      launcherRpcArgs(LAUNCHER_DEVICE_ID, parsed.params),
    );
    if (error) {
      console.error("[launcher/command] enqueue failed", { code: error.code });
      return NextResponse.json(
        { error: "ไม่สามารถสร้างคำสั่งยิงได้", errorCode: "COMMAND_ENQUEUE_FAILED" },
        { status: 503 },
      );
    }

    return NextResponse.json({ command, errorCode: null }, { status: 202 });
  } catch (error) {
    console.error("[launcher/command] request failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json(
      { error: "ระบบเครื่องยิงขัดข้อง กรุณาลองใหม่", errorCode: "DATABASE_ERROR" },
      { status: 503 },
    );
  }
}
