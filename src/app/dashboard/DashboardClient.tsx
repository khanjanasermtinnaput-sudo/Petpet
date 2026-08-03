"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { canFeedNow, type DeviceStatusResponse } from "@/lib/device-status";
import { isEatingLow, rollingAverageForSlot } from "@/lib/feeding-logic";
import {
  feedOutcomeCode,
  feedResultMessage,
  feedTimeoutCode,
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
import { DeviceConnectionStatus } from "@/components/dashboard/DeviceConnectionStatus";
import { FeedCommandStatus, type FeedDiagnostic } from "@/components/dashboard/FeedCommandStatus";
import { ManualFeedButton } from "@/components/dashboard/ManualFeedButton";
import { NavRail } from "@/components/dashboard/NavRail";
import { NeuToast } from "@/components/neu/NeuToast";

const POLL_INTERVAL_MS = 15_000;

interface ManualFeedResponse {
  error?: string;
  dispenseAmountG?: number;
  command?: FeederCommand;
  errorCode?: string;
}


interface CommandStatusResponse {
  command?: FeederCommand;
  errorCode?: string;
}

const COMMAND_STATUS_REQUEST_TIMEOUT_MS = 4_000;

async function fetchCommandStatus(commandId: string): Promise<FeederCommand | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), COMMAND_STATUS_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`/api/feed/command?commandId=${encodeURIComponent(commandId)}`, {
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const body = (await response.json()) as CommandStatusResponse;
    return body.command ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
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
  const [deviceConnection, setDeviceConnection] = useState<DeviceStatusResponse | null>(null);
  const [feedDiagnostic, setFeedDiagnostic] = useState<FeedDiagnostic | null>(null);
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
    if (!canFeedNow(deviceConnection)) {
      setFeedDiagnostic({
        kind: "error",
        code: "DEVICE_OFFLINE",
        message: "เครื่องให้อาหารยังไม่พร้อมใช้งาน",
        detail: "ระบบยังไม่สร้างคำสั่ง เพราะเครื่องไม่มี heartbeat ล่าสุด",
      });
      showToast("เครื่องให้อาหารยังไม่พร้อมใช้งาน", true);
      return;
    }

    setFeedDiagnostic(null);
    showToast("กำลังเทอาหาร...", false);

    let commandId: string;
    try {
      const res = await fetch("/api/feed/manual", { method: "POST" });
      const body: ManualFeedResponse = await res.json().catch(() => ({}));

      if (!res.ok || !body.command) {
        console.error("[feed] /api/feed/manual rejected the request", {
          status: res.status,
          error: body.error,
        });
        const errorCode = body.errorCode ?? "API_REQUEST_FAILED";
        setFeedDiagnostic({ kind: "error", code: errorCode, message: body.error ?? "ให้อาหารไม่สำเร็จ", detail: "คำสั่งถูกปฏิเสธก่อนถึง ESP8266" });
        showToast(body.error ?? "ให้อาหารไม่สำเร็จ กรุณาลองใหม่", true);
        return;
      }
      commandId = body.command.id;
    } catch (err) {
      console.error("[feed] /api/feed/manual unreachable", err);
      setFeedDiagnostic({ kind: "error", code: "API_UNREACHABLE", message: "ส่งคำสั่งให้อาหารไม่สำเร็จ", detail: "เว็บติดต่อ API ไม่ได้ ตรวจสอบ deployment หรือเครือข่าย" });
      showToast("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่", true);
      return;
    }

    // Awaiting this is what keeps ManualFeedButton's spinner going: it owns
    // its own loading state and clears it when this promise settles.
    const { message, succeeded, code } = await new Promise<{
      message: string;
      succeeded: boolean;
      code: string;
    }>((resolve) => {
      let stage: "pending" | "running" = "pending";
      let pollTimer: ReturnType<typeof setInterval> | null = null;
      let timer: ReturnType<typeof setTimeout>;
      let pollInFlight = false;

      const settle = (m: string, ok = false, errorCode = "UNKNOWN") => {
        clearTimeout(timer);
        if (pollTimer) clearInterval(pollTimer);
        pendingFeedRef.current = null;
        resolve({ message: m, succeeded: ok, code: errorCode });
      };

      const markRunning = () => {
        if (stage === "running") return;
        stage = "running";
        clearTimeout(timer);
        timer = setTimeout(() => void giveUp("execute"), RUNNING_TIMEOUT_MS);
      };

      const syncCommand = async () => {
        if (pollInFlight) return;
        pollInFlight = true;
        const row = await fetchCommandStatus(commandId);
        pollInFlight = false;
        if (!row) return;
        if (row.status === "running") markRunning();
        if (isTerminalStatus(row.status)) {
          settle(feedResultMessage(row), row.status === "success", feedOutcomeCode(row));
        }
      };

      const giveUp = async (reason: "pickup" | "execute") => {
        const row = await fetchCommandStatus(commandId);
        if (row && isTerminalStatus(row.status)) {
          settle(feedResultMessage(row), row.status === "success", feedOutcomeCode(row));
          return;
        }
        if (row?.status === "running" && reason === "pickup") {
          markRunning();
          return;
        }
        const errorCode = feedTimeoutCode(reason);
        console.error(`[feed] ${errorCode} for command ${commandId}`);
        settle(feedTimeoutMessage(reason), false, errorCode);
      };

      timer = setTimeout(() => void giveUp("pickup"), PENDING_TIMEOUT_MS);
      pollTimer = setInterval(() => void syncCommand(), 2_000);
      void syncCommand();

      pendingFeedRef.current = {
        commandId,
        onUpdate: (row) => {
          if (row.id !== commandId) return;
          if (row.status === "running") {
            clearTimeout(timer);
            markRunning();
            return;
          }
          if (isTerminalStatus(row.status)) {
            settle(feedResultMessage(row), row.status === "success", feedOutcomeCode(row));
          }
        },
      };
    });

    const diagnosticDetail = succeeded
      ? "ESP8266 รายงานผลกลับฐานข้อมูลแล้ว"
      : code === "COMMAND_NOT_CLAIMED"
        ? "สร้างคำสั่งแล้ว แต่ ESP8266 ไม่รับคำสั่งภายในเวลาที่กำหนด"
        : code === "COMMAND_EXECUTION_TIMEOUT"
          ? "ESP8266 รับคำสั่งแล้ว แต่ไม่รายงานผล ตรวจ servo, ไฟเลี้ยง และ Serial Monitor"
          : "ตรวจสอบไฟเลี้ยง servo, สายสัญญาณ D5 และข้อความใน Serial Monitor";
    setFeedDiagnostic({ kind: succeeded ? "success" : "error", code, message, detail: diagnosticDetail });
    showToast(message, true);

    // recentEvents is a server snapshot taken at page render, so without this
    // a completed feed leaves the low-eating alert and /history showing
    // pre-feed data until a manual reload.
    if (succeeded) router.refresh();
  }, [deviceConnection, router, showToast]);

  return (
    <div className="min-h-screen pb-28 md:pb-8 md:pl-24">
      <TopBar petName={pet.name} uvOn={status?.uv_status ?? false} />
      <main className="mx-auto flex max-w-3xl flex-col gap-4 px-4 sm:px-8">
        <DeviceConnectionStatus onStatusChange={setDeviceConnection} />
        <FeedCommandStatus diagnostic={feedDiagnostic} onDismiss={() => setFeedDiagnostic(null)} />
        {showLowEatingAlert && !alertDismissed && (
          <LowEatingAlert onDismiss={() => setAlertDismissed(true)} />
        )}
        <TrayHeroCard
          trayWeightG={reading?.tray_weight_g ?? 0}
          targetG={pet.daily_target_g}
        />
      </main>
      <ManualFeedButton onFeed={handleManualFeed} disabled={!canFeedNow(deviceConnection)} />
      <NeuToast message={toast.message} visible={toast.visible} />
      <NavRail />
    </div>
  );
}
