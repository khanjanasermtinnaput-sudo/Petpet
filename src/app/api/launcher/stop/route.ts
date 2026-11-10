import { NextResponse } from "next/server";
import { LAUNCHER_DEVICE_ID } from "@/lib/launcher-commands";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Stops the current drill. Safe to leave unauthenticated: it can only make
 * the machine do less. A running drill stops at the machine's next progress
 * report; a still-pending one is cancelled immediately.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("request_launcher_stop", {
      p_device_id: LAUNCHER_DEVICE_ID,
    });
    if (error) {
      console.error("[launcher/stop] failed", { code: error.code });
      return NextResponse.json(
        { error: "ส่งคำสั่งหยุดไม่สำเร็จ", errorCode: "DATABASE_ERROR" },
        { status: 503 },
      );
    }
    // A composite-returning RPC yields an all-null row when nothing matched.
    const stopped = data && data.id ? data : null;
    return NextResponse.json({ command: stopped, stopped: stopped !== null, errorCode: null });
  } catch (error) {
    console.error("[launcher/stop] request failed", {
      message: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json(
      { error: "ส่งคำสั่งหยุดไม่สำเร็จ", errorCode: "DATABASE_ERROR" },
      { status: 503 },
    );
  }
}
