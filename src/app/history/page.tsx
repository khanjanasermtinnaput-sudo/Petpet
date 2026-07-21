import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/device";
import type { FeedEvent } from "@/lib/types";
import { NavRail } from "@/components/dashboard/NavRail";
import { NeuThemeToggle } from "@/components/neu/NeuThemeToggle";
import { WeeklyFeedChart, type DailyMealDatum } from "@/components/history/WeeklyFeedChart";

// Daily/weekly aggregates don't need to be instantaneous — a short
// revalidation window lets repeat nav clicks hit cache instead of paying a
// full serverless + Supabase round trip every time.
export const revalidate = 5;

const DAY_LABEL_FORMAT = new Intl.DateTimeFormat("th-TH", { day: "numeric", month: "short" });

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function sevenDaysAgoIso(): string {
  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
}

function buildLastSevenDays(events: FeedEvent[]): DailyMealDatum[] {
  const days: DailyMealDatum[] = [];
  const bucketsByKey = new Map<string, DailyMealDatum>();

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const datum: DailyMealDatum = {
      dateLabel: DAY_LABEL_FORMAT.format(d),
      breakfast: 0,
      lunch: 0,
      dinner: 0,
    };
    days.push(datum);
    bucketsByKey.set(dateKey(d), datum);
  }

  for (const event of events) {
    const bucket = bucketsByKey.get(dateKey(new Date(event.ts)));
    if (!bucket) continue; // outside the 7-day window
    bucket[event.meal_slot] += event.actual_eaten_g;
  }

  return days;
}

export default async function HistoryPage() {
  const supabase = await createClient();
  const pet = await getPet(supabase);

  if (!pet) redirect("/onboarding");

  const { data: events } = await supabase
    .from("feed_events")
    .select("*")
    .eq("device_id", pet.device_id)
    .gte("ts", sevenDaysAgoIso())
    .order("ts", { ascending: true });

  const chartData = buildLastSevenDays((events ?? []) as FeedEvent[]);

  return (
    <div className="min-h-screen pb-28 md:pb-8 md:pl-24">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-neu-bg/90 px-4 py-4 backdrop-blur-sm sm:px-8">
        <h1 className="text-lg font-bold text-neu-ink">ประวัติการให้อาหาร</h1>
        <NeuThemeToggle />
      </header>
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 sm:px-8">
        <WeeklyFeedChart data={chartData} />
      </main>
      <NavRail />
    </div>
  );
}
