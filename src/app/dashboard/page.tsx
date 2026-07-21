import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FeedEvent } from "@/lib/types";
import { DashboardClient } from "./DashboardClient";

function startOfTodayIso(): string {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return start.toISOString();
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: pet } = await supabase
    .from("pets")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

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
