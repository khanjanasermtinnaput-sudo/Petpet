import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/device";
import { NavRail } from "@/components/dashboard/NavRail";
import { NeuThemeToggle } from "@/components/neu/NeuThemeToggle";
import { PetProfileEditor } from "@/components/settings/PetProfileEditor";
import { ScheduleClient } from "@/components/schedule/ScheduleClient";
import type { FeedingSchedule } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const supabase = await createClient();
  const pet = await getPet(supabase);

  if (!pet) redirect("/onboarding");

  const [{ data: schedule }, { data: { user } }] = await Promise.all([
    supabase
      .from("feeding_schedule")
      .select("*")
      .eq("device_id", pet.device_id)
      .order("time_of_day", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  return (
    <div className="min-h-screen pb-28 md:pb-8 md:pl-24">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-neu-bg/90 px-4 py-4 backdrop-blur-sm sm:px-8">
        <h1 className="text-lg font-bold text-neu-ink">ตั้งค่า</h1>
        <NeuThemeToggle />
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-6 sm:px-8">
        <PetProfileEditor pet={pet} authenticated={Boolean(user)} />
        <section>
          <h2 className="mb-3 text-lg font-bold text-neu-ink">ตารางการให้อาหาร</h2>
          <ScheduleClient initialSchedule={(schedule ?? []) as FeedingSchedule[]} />
        </section>
      </main>
      <NavRail />
    </div>
  );
}
