"use client";

import { useState } from "react";
import { NeuButton } from "@/components/neu/NeuButton";

interface UvControlProps {
  uvOn: boolean;
  deviceOnline: boolean;
}

export function UvControl({ uvOn, deviceOnline }: UvControlProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextState = !uvOn;

  async function handleToggle() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/device/uv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uvOn: nextState }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "ส่งคำสั่งไม่สำเร็จ");
      }
    } catch {
      setError("เชื่อมต่อเครื่องให้อาหารไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="neu-raised-sm flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-bold text-neu-ink">ไฟ UV ฆ่าเชื้อ</p>
        <p className="mt-1 text-xs text-neu-ink-muted">
          {uvOn ? "กำลังเปิดใช้งาน" : "ปิดอยู่"} · {deviceOnline ? "พร้อมใช้งาน" : "เครื่องออฟไลน์"}
        </p>
        {error && <p className="mt-2 text-xs font-semibold text-neu-warning">{error}</p>}
      </div>
      <NeuButton
        type="button"
        variant={uvOn ? "default" : "accent"}
        disabled={busy || !deviceOnline}
        onClick={handleToggle}
        className="min-w-28"
        aria-pressed={uvOn}
      >
        {busy ? "กำลังส่ง..." : uvOn ? "ปิดไฟ UV" : "เปิดไฟ UV"}
      </NeuButton>
    </section>
  );
}
