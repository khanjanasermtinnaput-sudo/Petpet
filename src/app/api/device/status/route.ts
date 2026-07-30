import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/device";

/**
 * Liveness for the feeder paired with the current pet: online/offline inputs
 * (last_seen_at plus the server's own clock), last feed, firmware and signal.
 *
 * Calling this also runs the lazy command expiry — there is no cron, so a
 * command queued for an offline feeder is only marked failed when something
 * next looks at the system, and this is that something.
 */
export async function GET() {
  const supabase = await createClient();
  const pet = await getPet(supabase);

  if (!pet) {
    return NextResponse.json({ error: "ไม่พบข้อมูลสัตว์เลี้ยง" }, { status: 404 });
  }

  const { data: deviceStatus, error } = await supabase.rpc("device_health", {
    p_device_id: pet.device_id,
  });

  if (error) {
    console.error("[device/status] device_health failed", {
      device_id: pet.device_id,
      code: error.code,
      message: error.message,
    });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ deviceStatus });
}
