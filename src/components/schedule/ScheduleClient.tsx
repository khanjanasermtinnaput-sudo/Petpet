"use client";

import { useState } from "react";
import { NeuButton } from "@/components/neu/NeuButton";
import { NeuCard } from "@/components/neu/NeuCard";
import type { FeedingSchedule, MealSlot } from "@/lib/types";

const MEAL_SLOT_LABELS_TH: Record<MealSlot, string> = {
  breakfast: "เช้า",
  lunch: "กลางวัน",
  dinner: "เย็น",
};

interface GenerateResponse {
  error?: string;
  schedule?: FeedingSchedule[];
}

export function ScheduleClient({ initialSchedule }: { initialSchedule: FeedingSchedule[] }) {
  const [schedule, setSchedule] = useState(initialSchedule);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/schedule/generate", { method: "POST" });
      const body: GenerateResponse = await res.json().catch(() => ({}));

      if (!res.ok || !body.schedule) {
        setError(body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
      } else {
        setSchedule(body.schedule);
      }
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {schedule.length === 0 ? (
        <NeuCard className="text-center text-sm text-neu-ink-muted">
          ยังไม่มีตารางการให้อาหาร — ให้ AI สัตวแพทย์ช่วยวางแผนได้เลย
        </NeuCard>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {schedule.map((meal) => (
            <NeuCard key={meal.id} className="flex flex-col items-center gap-1 text-center">
              <span className="text-sm font-semibold text-neu-ink-muted">
                {MEAL_SLOT_LABELS_TH[meal.meal_slot]}
              </span>
              <span className="text-2xl font-bold text-neu-ink">
                {meal.time_of_day.slice(0, 5)}
              </span>
              <span className="text-sm text-neu-accent">{meal.target_g}g</span>
              {meal.source === "ai" && (
                <span className="mt-1 text-xs text-neu-ink-muted">✨ วางแผนโดย AI</span>
              )}
            </NeuCard>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="text-center text-sm font-semibold text-neu-warning">
          {error}
        </p>
      )}

      <NeuButton
        type="button"
        variant="accent"
        disabled={loading}
        onClick={handleGenerate}
        className="mx-auto"
      >
        {loading ? "กำลังวางแผน..." : "ให้ AI จัดตารางอาหาร"}
      </NeuButton>

      <p className="text-center text-xs text-neu-ink-muted">
        คำแนะนำจาก AI เป็นข้อมูลทั่วไปเท่านั้น ไม่ใช่คำวินิจฉัยจากสัตวแพทย์ตัวจริง
      </p>
    </div>
  );
}
