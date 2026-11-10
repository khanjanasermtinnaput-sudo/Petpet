import { NextResponse } from "next/server";
import { LAUNCHER_DEVICE_ID, launcherHealthFromRpc } from "@/lib/launcher-commands";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/** Liveness + telemetry for the shuttle launcher. */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("launcher_health", {
      p_device_id: LAUNCHER_DEVICE_ID,
    });
    if (error) throw error;
    return NextResponse.json(
      { deviceId: LAUNCHER_DEVICE_ID, ...launcherHealthFromRpc(data) },
      { headers: NO_STORE },
    );
  } catch (error) {
    console.error("[launcher/status] check failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json(
      { error: "ตรวจสอบสถานะเครื่องยิงไม่ได้", errorCode: "DATABASE_ERROR" },
      { status: 503, headers: NO_STORE },
    );
  }
}
