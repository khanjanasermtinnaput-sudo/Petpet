import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/active-pet";
import type { FeedEvent } from "@/lib/types";
import { DashboardClient } from "./DashboardClient";

// Tray readings and the low-eating check both change continuously —
// must not be statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const pet = await getPet(supabase);

  if (!pet) redirect("/onboarding");

  const [{ data: latestReading }, { data: recentEvents }] = await Promise.all([
    supabase
      .from("feeder_readings")
      .select("*")
      .eq("device_id", pet.device_id)
      .order("recorded_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("feed_events")
      .select("*")
      .eq("pet_id", pet.id)
      .order("ts", { ascending: false })
      .limit(60),
  ]);

  return (
    <DashboardClient
      pet={pet}
      initialReading={latestReading ?? null}
      recentEvents={(recentEvents ?? []) as FeedEvent[]}
    />
  );
}
