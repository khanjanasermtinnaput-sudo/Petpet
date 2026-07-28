"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isEatingLow, rollingAverageForSlot } from "@/lib/feeding-logic";
import {
  feedResultMessage,
  feedTimeoutMessage,
  isTerminalStatus,
  PENDING_TIMEOUT_MS,
  RUNNING_TIMEOUT_MS,
  TOAST_HIDE_MS,
} from "@/lib/feeder-commands";
import type {
  DeviceStatus,
  FeedEvent,
  FeederCommand,
  FeederReading,
  Pet,
} from "@/lib/types";
import { TopBar } from "@/components/dashboard/TopBar";
import { TrayHeroCard } from "@/components/dashboard/TrayHeroCard";
import { LowEatingAlert } from "@/components/dashboard/LowEatingAlert";
import { ManualFeedButton } from "@/components/dashboard/ManualFeedButton";
import { NavRail } from "@/components/dashboard/NavRail";
import { NeuToast } from "@/components/neu/NeuToast";

const POLL_INTERVAL_MS = 15_000;

interface ManualFeedResponse {
  error?: string;
  dispenseAmountG?: number;
  command?: FeederCommand;
}

interface DashboardClientProps {
  pet: Pet;
  initialReading: FeederReading | null;
  initialStatus: DeviceStatus | null;
  recentEvents: FeedEvent[];
}

export function DashboardClient({
  pet,
  initialReading,
  initialStatus,
  recentEvents,
}: DashboardClientProps) {
  const router = useRouter();
  const [reading, setReading] = useState(initialReading);
  const [status, setStatus] = useState(initialStatus);
  const [alertDismissed, setAlertDismissed] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: "",
    visible: false,
  });

  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Lets the realtime handler below reach the in-flight feed without the
  // subscription effect (keyed on device_id) closing over handleManualFeed.
  const pendingFeedRef = useRef<{
    commandId: string;
    onUpdate: (row: FeederCommand) => void;
  } | null>(null);

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
      .channel(`Petpet-dashboard-${pet.device_id}`)
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
      .on<FeederCommand>(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "feeder_commands",
          filter: `device_id=eq.${pet.device_id}`,
        },
        (payload) => pendingFeedRef.current?.onUpdate(payload.new),
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

  useEffect(() => {
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, []);

  const showLowEatingAlert = useMemo(() => {
    const latestConsumed = recentEvents.find((e) => e.actual_eaten_g > 0);
    if (!latestConsumed) return false;

    const baselineHistory = recentEvents.filter((e) => e.id !== latestConsumed.id);
    const baseline = rollingAverageForSlot(baselineHistory, latestConsumed.meal_slot, 5);
    return isEatingLow(latestConsumed.actual_eaten_g, baseline);
  }, [recentEvents]);

  // The "กำลังเทอาหาร..." stage has to stay up until the feeder answers, so the
  // hide timer is owned by a ref and cleared on every new toast. The old
  // unconditional setTimeout in handleManualFeed's finally would have hidden
  // the result message three seconds after the *request* went out.
  const showToast = useCallback((message: string, autoHide: boolean) => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    setToast({ message, visible: true });
    if (autoHide) {
      hideTimerRef.current = setTimeout(
        () => setToast((t) => ({ ...t, visible: false })),
        TOAST_HIDE_MS,
      );
    }
  }, []);

  const handleManualFeed = useCallback(async () => {
    showToast("กำลังเทอาหาร...", false);

    let commandId: string;
    try {
      const res = await fetch("/api/feed/manual", { method: "POST" });
      const body: ManualFeedResponse = await res.json().catch(() => ({}));

      if (!res.ok || !body.command) {
        showToast(body.error ?? "ให้อาหารไม่สำเร็จ กรุณาลองใหม่", true);
        return;
      }
      commandId = body.command.id;
    } catch {
      showToast("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่", true);
      return;
    }

    // Awaiting this is what keeps ManualFeedButton's spinner going: it owns
    // its own loading state and clears it when this promise settles.
    const { message, succeeded } = await new Promise<{
      message: string;
      succeeded: boolean;
    }>((resolve) => {
      let timer: ReturnType<typeof setTimeout>;

      const settle = (m: string, ok = false) => {
        clearTimeout(timer);
        pendingFeedRef.current = null;
        resolve({ message: m, succeeded: ok });
      };

      // Two deadlines, because they mean different things: a feeder polling at
      // 1 Hz that hasn't claimed the command is simply not there, while one
      // that has claimed it still has a servo run to finish.
      const giveUp = async (reason: "pickup" | "execute") => {
        const supabase = createClient();

        // Don't cry failure without looking. If the realtime channel dropped,
        // or the result landed between the fetch returning and this handler
        // being registered, the command may already be finished — and telling
        // someone a feed failed when it didn't invites a second one.
        const { data: row } = await supabase
          .from("feeder_commands")
          .select("*")
          .eq("id", commandId)
          .maybeSingle();

        if (row && isTerminalStatus(row.status)) {
          settle(feedResultMessage(row), row.status === "success");
          return;
        }

        // Nothing polls while the feeder is offline, so nothing would ever run
        // the lazy expiry. Poking device_health() flips the row to failed
        // server-side, so the database agrees with what the user just saw.
        void supabase.rpc("device_health", { p_device_id: pet.device_id });
        settle(feedTimeoutMessage(reason));
      };

      timer = setTimeout(() => void giveUp("pickup"), PENDING_TIMEOUT_MS);

      pendingFeedRef.current = {
        commandId,
        onUpdate: (row) => {
          if (row.id !== commandId) return;
          if (row.status === "running") {
            clearTimeout(timer);
            timer = setTimeout(() => void giveUp("execute"), RUNNING_TIMEOUT_MS);
            return;
          }
          if (isTerminalStatus(row.status)) {
            settle(feedResultMessage(row), row.status === "success");
          }
        },
      };
    });

    showToast(message, true);

    // recentEvents is a server snapshot taken at page render, so without this
    // a completed feed leaves the low-eating alert and /history showing
    // pre-feed data until a manual reload.
    if (succeeded) router.refresh();
  }, [pet.device_id, router, showToast]);

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
      </main>
      <ManualFeedButton onFeed={handleManualFeed} />
      <NeuToast message={toast.message} visible={toast.visible} />
      <NavRail />
    </div>
  );
}
