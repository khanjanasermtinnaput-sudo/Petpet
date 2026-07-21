import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/device";
import { NavRail } from "@/components/dashboard/NavRail";
import { ScheduleClient } from "@/components/schedule/ScheduleClient";
import type { FeedingSchedule } from "@/lib/types";

// The schedule rarely changes and the "generate" button updates its own
// displayed state client-side without a page reload, so a short revalidation
// window is safe and lets repeat nav clicks hit cache.
export const revalidate = 5;

export default async function SettingsPage() {
  const supabase = await createClient();
  const pet = await getPet(supabase);

  if (!pet) redirect("/onboarding");

  const { data: schedule } = await supabase
    .from("feeding_schedule")
    .select("*")
    .eq("device_id", pet.device_id)
    .order("time_of_day", { ascending: true });

  return (
    <div className="min-h-screen pb-28 md:pb-8 md:pl-24">
      <header className="sticky top-0 z-30 bg-neu-bg/90 px-4 py-4 backdrop-blur-sm sm:px-8">
        <h1 className="text-lg font-bold text-neu-ink">ตารางการให้อาหาร</h1>
      </header>
      <main className="mx-auto max-w-3xl px-4 sm:px-8">
        <ScheduleClient initialSchedule={(schedule ?? []) as FeedingSchedule[]} />
      </main>
      <NavRail />
    </div>
  );
}
