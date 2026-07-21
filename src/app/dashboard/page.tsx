import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/device";
import type { FeedEvent } from "@/lib/types";
import { DashboardClient } from "./DashboardClient";

// Tray readings, UV status, and the low-eating check all change
// continuously — must not be statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const pet = await getPet(supabase);

  if (!pet) redirect("/onboarding");

  const [{ data: latestReading }, { data: status }, { data: recentEvents }] = await Promise.all([
    supabase
      .from("feeder_readings")
      .select("*")
      .eq("device_id", pet.device_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("device_status").select("*").eq("device_id", pet.device_id).maybeSingle(),
    supabase
      .from("feed_events")
      .select("*")
      .eq("device_id", pet.device_id)
      .order("ts", { ascending: false })
      .limit(60),
  ]);

  return (
    <DashboardClient
      pet={pet}
      initialReading={latestReading ?? null}
      initialStatus={status ?? null}
      recentEvents={(recentEvents ?? []) as FeedEvent[]}
    />
  );
}
