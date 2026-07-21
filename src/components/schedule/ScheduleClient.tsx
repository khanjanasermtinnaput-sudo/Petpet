"use client";

import { useState, useSyncExternalStore } from "react";
import { NeuButton } from "@/components/neu/NeuButton";
import { NeuCard } from "@/components/neu/NeuCard";
import type { FeedingSchedule, MealSlot } from "@/lib/types";

const MEAL_SLOT_LABELS_TH: Record<MealSlot, string> = {
  breakfast: "เช้า",
  lunch: "กลางวัน",
  dinner: "เย็น",
};

const DOW_LABELS_TH = ["จ", "อ", "พ", "พฤ", "ศ", "ส", "อา"]; // Monday-first
const MONTH_LABELS_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];

const START_HOUR = 6;
const END_HOUR = 22;
const PX_PER_HOUR = 32;

interface GenerateResponse {
  error?: string;
  schedule?: FeedingSchedule[];
}

function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0 = Sunday
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + mondayOffset);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function minutesSinceStart(hours: number, minutes: number): number {
  return (hours - START_HOUR) * 60 + minutes;
}

function offsetPx(hours: number, minutes: number): number {
  const clamped = Math.min(
    Math.max(minutesSinceStart(hours, minutes), 0),
    (END_HOUR - START_HOUR) * 60,
  );
  return (clamped / 60) * PX_PER_HOUR;
}

function parseTimeOfDay(timeOfDay: string): { hours: number; minutes: number } {
  const [hours, minutes] = timeOfDay.split(":").map(Number);
  return { hours, minutes };
}

// Ticks once a minute. Returns the minute epoch (a stable primitive, so
// useSyncExternalStore doesn't re-render every render) rather than a fresh
// Date, and reports `null` for the server snapshot since the client's wall
// clock can't be known during SSR.
function subscribeToClock(callback: () => void) {
  const id = setInterval(callback, 60_000);
  return () => clearInterval(id);
}

function getClockSnapshot(): number {
  return Math.floor(Date.now() / 60_000);
}

function getServerClockSnapshot(): null {
  return null;
}

export function ScheduleClient({ initialSchedule }: { initialSchedule: FeedingSchedule[] }) {
  const [schedule, setSchedule] = useState(initialSchedule);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Rendering "now" (the current-time line, done/upcoming status, and which
  // week the day strip shows) depends on the client's wall clock, which
  // can't match the server's render time — so it's null on the server/first
  // paint and resolves once mounted, then ticks every minute.
  const minuteEpoch = useSyncExternalStore(
    subscribeToClock,
    getClockSnapshot,
    getServerClockSnapshot,
  );
  const now = minuteEpoch == null ? null : new Date(minuteEpoch * 60_000);

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

  const sortedSchedule = [...schedule].sort((a, b) =>
    a.time_of_day.localeCompare(b.time_of_day),
  );

  const nowHM = now ? { hours: now.getHours(), minutes: now.getMinutes() } : null;
  const nowTimeStr = now
    ? `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`
    : null;
  const nowInRange = nowHM ? nowHM.hours >= START_HOUR && nowHM.hours < END_HOUR : false;

  const weekDates = now
    ? Array.from({ length: 7 }, (_, i) => {
        const d = new Date(startOfWeek(now));
        d.setDate(d.getDate() + i);
        return d;
      })
    : [];

  return (
    <div className="flex flex-col gap-4">
      {schedule.length === 0 ? (
        <NeuCard className="text-center text-sm text-neu-ink-muted">
          ยังไม่มีตารางการให้อาหาร — ให้ AI สัตวแพทย์ช่วยวางแผนได้เลย
        </NeuCard>
      ) : !now ? (
        <NeuCard className="h-[420px] animate-pulse" aria-hidden />
      ) : (
        <NeuCard>
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm font-bold text-neu-ink">
              {MONTH_LABELS_TH[now.getMonth()]} {now.getFullYear() + 543}
            </span>
          </div>

          <div className="mb-4 flex justify-between gap-1">
            {weekDates.map((d, i) => {
              const isToday = d.toDateString() === now.toDateString();
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1 py-1">
                  <span className="text-[10px] font-semibold text-neu-ink-muted">
                    {DOW_LABELS_TH[i]}
                  </span>
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      isToday ? "bg-neu-accent text-white" : "text-neu-ink"
                    }`}
                  >
                    {d.getDate()}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="mb-4 text-center text-[11px] text-neu-ink-muted">
            ตารางนี้ใช้ซ้ำทุกวัน — เลือกวันอื่นยังไม่รองรับ
          </p>

          <div className="relative pl-11">
            {Array.from(
              { length: (END_HOUR - START_HOUR) / 2 },
              (_, i) => START_HOUR + i * 2,
            ).map((hour, i) => (
              <div
                key={hour}
                className={`relative h-16 ${i === 0 ? "" : "border-t border-dashed border-neu-ink-muted/30"}`}
              >
                <span className="absolute -left-11 -top-2 w-9 text-[10px] font-semibold text-neu-ink-muted">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            ))}

            {nowInRange && nowHM && nowTimeStr && (
              <div
                className="absolute -left-11 right-0 z-10 flex items-center gap-1"
                style={{ top: offsetPx(nowHM.hours, nowHM.minutes) }}
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-neu-warning" />
                <span className="-ml-1 shrink-0 rounded bg-neu-warning px-1.5 py-0.5 text-[9px] font-bold text-white">
                  ตอนนี้ {nowTimeStr}
                </span>
                <span className="h-0.5 flex-1 bg-neu-warning/80" />
              </div>
            )}

            {sortedSchedule.map((meal) => {
              const { hours, minutes } = parseTimeOfDay(meal.time_of_day);
              const done = nowHM
                ? hours < nowHM.hours || (hours === nowHM.hours && minutes <= nowHM.minutes)
                : false;
              return (
                <div
                  key={meal.id}
                  className="neu-raised absolute left-1 right-1 z-20 flex items-center gap-2.5 px-3 py-2"
                  style={{ top: offsetPx(hours, minutes) }}
                >
                  <span
                    className={`w-1 shrink-0 self-stretch rounded-full ${
                      done ? "bg-neu-success" : "bg-neu-accent"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-bold text-neu-ink">
                        {MEAL_SLOT_LABELS_TH[meal.meal_slot]}
                      </span>
                      <span className="text-xs font-semibold text-neu-ink-muted">
                        {meal.time_of_day.slice(0, 5)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-semibold text-neu-accent">
                        {meal.target_g}g
                      </span>
                      {meal.source === "ai" && (
                        <span className="text-[10px] text-neu-ink-muted">· AI แนะนำ</span>
                      )}
                    </div>
                  </div>
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      done ? "bg-neu-success text-white" : "neu-inset text-neu-ink-muted"
                    }`}
                    aria-hidden
                  >
                    {done ? "✓" : "⏳"}
                  </span>
                </div>
              );
            })}
          </div>
        </NeuCard>
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
