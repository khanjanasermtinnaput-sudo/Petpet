"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isEatingLow, rollingAverageForSlot } from "@/lib/feeding-logic";
import type { DeviceStatus, FeedEvent, FeederReading, MealSlot, Pet } from "@/lib/types";
import { TopBar } from "@/components/dashboard/TopBar";
import { TrayHeroCard } from "@/components/dashboard/TrayHeroCard";
import { TankCard } from "@/components/dashboard/TankCard";
import { FeedHistoryChart, buildMealSlotData } from "@/components/dashboard/FeedHistoryChart";
import { LowEatingAlert } from "@/components/dashboard/LowEatingAlert";
import { ManualFeedButton } from "@/components/dashboard/ManualFeedButton";
import { NavRail } from "@/components/dashboard/NavRail";
import { NeuToast } from "@/components/neu/NeuToast";

const MEAL_SLOTS: readonly MealSlot[] = ["breakfast", "lunch", "dinner"];
const POLL_INTERVAL_MS = 15_000;

interface ManualFeedResponse {
  error?: string;
  dispenseAmountG?: number;
  feedEvent?: FeedEvent;
}

interface DashboardClientProps {
  pet: Pet;
  initialReading: FeederReading | null;
  initialStatus: DeviceStatus | null;
  initialTodayEvents: FeedEvent[];
  recentEvents: FeedEvent[];
}

export function DashboardClient({
  pet,
  initialReading,
  initialStatus,
  initialTodayEvents,
  recentEvents,
}: DashboardClientProps) {
  const [reading, setReading] = useState(initialReading);
  const [status, setStatus] = useState(initialStatus);
  const [todayEvents, setTodayEvents] = useState(initialTodayEvents);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: "",
    visible: false,
  });

  useEffect(() => {
    const supabase = createClient();
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    async function pollOnce() {
      const [{ data: r }, { data: s }] = await Promise.all([
        supabase
          .from("feeder_readings")
          .select("*")
          .eq("device_id", pet.device_id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("device_status").select("*").eq("device_id", pet.device_id).maybeSingle(),
      ]);
      if (r) setReading(r);
      if (s) setStatus(s);
    }

    const channel = supabase
      .channel(`petpet-dashboard-${pet.device_id}`)
      .on<FeederReading>(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "feeder_readings",
          filter: `device_id=eq.${pet.device_id}`,
        },
        (payload) => setReading(payload.new),
      )
      .on<DeviceStatus>(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "device_status",
          filter: `device_id=eq.${pet.device_id}`,
        },
        (payload) => {
          if (payload.eventType === "DELETE") return;
          setStatus(payload.new);
        },
      )
      .subscribe((subStatus) => {
        if (subStatus === "SUBSCRIBED" && pollTimer) {
          clearInterval(pollTimer);
          pollTimer = null;
        } else if (
          (subStatus === "CHANNEL_ERROR" || subStatus === "TIMED_OUT" || subStatus === "CLOSED") &&
          !pollTimer
        ) {
          pollTimer = setInterval(pollOnce, POLL_INTERVAL_MS);
        }
      });

    return () => {
      supabase.removeChannel(channel);
      if (pollTimer) clearInterval(pollTimer);
    };
  }, [pet.device_id]);

  const chartData = useMemo(() => {
    const perSlotDefaultTarget = Math.round(pet.daily_target_g / MEAL_SLOTS.length);
    const totals = Object.fromEntries(
      MEAL_SLOTS.map((slot) => [slot, { target: 0, actual: 0, hasEvent: false }]),
    ) as Record<MealSlot, { target: number; actual: number; hasEvent: boolean }>;

    for (const event of todayEvents) {
      const bucket = totals[event.meal_slot];
      bucket.target += event.target_g;
      bucket.actual += event.actual_eaten_g;
      bucket.hasEvent = true;
    }

    for (const slot of MEAL_SLOTS) {
      if (!totals[slot].hasEvent) totals[slot].target = perSlotDefaultTarget;
    }

    return buildMealSlotData(totals);
  }, [todayEvents, pet.daily_target_g]);

  const showLowEatingAlert = useMemo(() => {
    const latestConsumed = recentEvents.find((e) => e.actual_eaten_g > 0);
    if (!latestConsumed) return false;

    const baselineHistory = recentEvents.filter((e) => e.id !== latestConsumed.id);
    const baseline = rollingAverageForSlot(baselineHistory, latestConsumed.meal_slot, 5);
    return isEatingLow(latestConsumed.actual_eaten_g, baseline);
  }, [recentEvents]);

  const handleManualFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/feed/manual", { method: "POST" });
      const body: ManualFeedResponse = await res.json().catch(() => ({}));

      if (!res.ok) {
        setToast({ message: body.error ?? "ให้อาหารไม่สำเร็จ กรุณาลองใหม่", visible: true });
      } else {
        setToast({
          message: `เทอาหารแล้ว ${Math.round(body.dispenseAmountG ?? 0)}g`,
          visible: true,
        });
        if (body.feedEvent) {
          const confirmedEvent = body.feedEvent;
          setTodayEvents((prev) => [...prev, confirmedEvent]);
        }
      }
    } catch {
      setToast({ message: "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่", visible: true });
    } finally {
      setTimeout(() => setToast((t) => ({ ...t, visible: false })), 3000);
    }
  }, []);

  return (
    <div className="min-h-screen pb-28 md:pb-8 md:pl-24">
      <TopBar petName={pet.name} uvOn={status?.uv_status ?? false} />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 sm:px-8">
        {showLowEatingAlert && !alertDismissed && (
          <LowEatingAlert onDismiss={() => setAlertDismissed(true)} />
        )}
        <TrayHeroCard
          trayWeightG={reading?.tray_weight_g ?? 0}
          targetG={pet.daily_target_g}
        />
        <TankCard tankWeightG={reading?.tank_weight_g ?? 0} />
        <FeedHistoryChart data={chartData} />
      </main>
      <ManualFeedButton onFeed={handleManualFeed} />
      <NeuToast message={toast.message} visible={toast.visible} />
      <NavRail />
    </div>
  );
}
