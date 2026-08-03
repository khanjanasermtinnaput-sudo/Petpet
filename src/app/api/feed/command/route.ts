import { NextResponse } from "next/server";
import { DEVICE_ID } from "@/lib/device";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
const NO_STORE_HEADERS = { "Cache-Control": "no-store, max-age=0" };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Read-only command progress endpoint used by the dashboard polling fallback. */
export async function GET(request: Request) {
  const commandId = new URL(request.url).searchParams.get("commandId");
  if (!commandId || !UUID_RE.test(commandId)) {
    return NextResponse.json(
      { error: "Invalid command id", errorCode: "INVALID_COMMAND_ID" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("feeder_commands")
      .select("id,device_id,status,target_g,dispensed_g,error,created_at,updated_at,executed_at,finished_at")
      .eq("id", commandId)
      .eq("device_id", DEVICE_ID)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return NextResponse.json(
        { error: "Command not found", errorCode: "COMMAND_NOT_FOUND" },
        { status: 404, headers: NO_STORE_HEADERS },
      );
    }

    return NextResponse.json({ command: data }, { headers: NO_STORE_HEADERS });
  } catch (error) {
    console.error("[feed/command] lookup failed", {
      command_id: commandId,
      message: error instanceof Error ? error.message : "unknown error",
    });
    return NextResponse.json(
      { error: "ตรวจสอบคำสั่งไม่ได้", errorCode: "DATABASE_ERROR" },
      { status: 503, headers: NO_STORE_HEADERS },
    );
  }
}