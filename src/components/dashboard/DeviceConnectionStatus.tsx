"use client";

import { useEffect, useRef, useState } from "react";
import { DEVICE_ID } from "@/lib/device";
import { lastSeenLabel } from "@/lib/device-health";
import {
  STATUS_REFRESH_INTERVAL_MS,
  unavailableDeviceStatus,
  type DeviceStatusResponse,
} from "@/lib/device-status";
import { createClient } from "@/lib/supabase/client";
import { NeuCard } from "@/components/neu/NeuCard";

const supabase = createClient();

interface DeviceConnectionStatusProps {
  onStatusChange?: (status: DeviceStatusResponse | null) => void;
}

export function DeviceConnectionStatus({ onStatusChange }: DeviceConnectionStatusProps) {
  const [status, setStatus] = useState<DeviceStatusResponse | null>(null);
  const callbackRef = useRef(onStatusChange);
  useEffect(() => {
    callbackRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    let disposed = false;
    let requestInFlight = false;
    let controller: AbortController | null = null;

    const refresh = async () => {
      if (requestInFlight || disposed) return;
      requestInFlight = true;
      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetch(`/api/device/status?deviceId=${encodeURIComponent(DEVICE_ID)}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const next = (await response.json()) as DeviceStatusResponse;
        if (!disposed && next.deviceId === DEVICE_ID && typeof next.reason === "string") {
          setStatus(next);
          callbackRef.current?.(next);
        }
      } catch (error) {
        if (!disposed && !(error instanceof DOMException && error.name === "AbortError")) {
          const unavailable = unavailableDeviceStatus(DEVICE_ID, "database_error");
          setStatus(unavailable);
          callbackRef.current?.(unavailable);
        }
      } finally {
        requestInFlight = false;
      }
    };

    const channel = supabase
      .channel(`petpet-device-status-${DEVICE_ID}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "device_status", filter: `device_id=eq.${DEVICE_ID}` },
        () => void refresh(),
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === "SUBSCRIBED") void refresh();
      });

    void refresh();
    const timer = setInterval(() => void refresh(), STATUS_REFRESH_INTERVAL_MS);

    return () => {
      disposed = true;
      clearInterval(timer);
      controller?.abort();
      void supabase.removeChannel(channel);
    };
  }, []);

  const loading = status === null;
  const online = status?.reason === "online";
  const tone = loading ? "bg-neu-ink-muted/50" : online ? "bg-neu-success" : "bg-red-500";
  const title = loading
    ? "กำลังตรวจสอบเครื่อง..."
    : online
      ? "เชื่อมต่อกับเครื่องแล้ว"
      : status.reason === "device_not_found"
        ? `ไม่พบเครื่อง ${status.deviceId} ในระบบ`
        : status.reason === "database_error" || status.reason === "unauthorized"
          ? "ตรวจสอบสถานะเครื่องไม่ได้"
          : "ไม่ได้เชื่อมต่อกับเครื่อง";
  const detail = loading
    ? "ระบบจะตรวจสอบสถานะทุก 5 วินาที"
    : online
      ? `เครื่อง ${status.deviceId} · ตรวจสอบอีกครั้งทุก 5 วินาที`
      : status.reason === "offline"
        ? "ตรวจสอบไฟ Wi-Fi หรือเฟิร์มแวร์ แล้วระบบจะเชื่อมต่อใหม่อัตโนมัติ"
        : "โปรดลองใหม่อีกครั้ง หากปัญหายังอยู่ให้ตรวจสอบการตั้งค่าฐานข้อมูล";

  return (
    <NeuCard>
      <section aria-live="polite" aria-atomic="true" className="flex items-start gap-3">
        <span
          className={`mt-1.5 h-3 w-3 shrink-0 rounded-full ${tone} ${online ? "shadow-[0_0_8px_var(--neu-success)]" : ""}`}
          aria-hidden
        />
        <div className="min-w-0">
          <h2 className="font-semibold text-neu-ink">{title}</h2>
          {!loading && status.lastSeenAt && (
            <p className="mt-1 text-sm text-neu-ink-muted">
              เห็นเครื่องล่าสุด: {lastSeenLabel(status.lastSeenAt, status.checkedAt)}
            </p>
          )}
          <p className="mt-1 text-sm text-neu-ink-muted">{detail}</p>
        </div>
      </section>
    </NeuCard>
  );
}