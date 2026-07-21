import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/device";
import type { FeedEvent } from "@/lib/types";
import { DashboardClient } from "./DashboardClient";

function startOfTodayIso(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

// Tray/tank readings, UV status, and feed history all change continuously —
// must not be statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const pet = await getPet(supabase);

  if (!pet) redirect("/onboarding");

  const [{ data: latestReading }, { data: status }, { data: todayEvents }, { data: recentEvents }] =
    await Promise.all([
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
        .gte("ts", startOfTodayIso())
        .order("ts", { ascending: true }),
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
      initialTodayEvents={(todayEvents ?? []) as FeedEvent[]}
      recentEvents={(recentEvents ?? []) as FeedEvent[]}
    />
  );
}
