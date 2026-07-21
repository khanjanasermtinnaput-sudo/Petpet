"use client";

import {
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { NeuCard } from "@/components/neu/NeuCard";
import type { MealSlot } from "@/lib/types";

export interface MealSlotDatum {
  slot: MealSlot;
  labelTh: string;
  target: number;
  actual: number;
}

const MEAL_SLOT_LABELS_TH: Record<MealSlot, string> = {
  breakfast: "เช้า",
  lunch: "กลางวัน",
  dinner: "เย็น",
};

export function buildMealSlotData(
  slotTotals: Record<MealSlot, { target: number; actual: number }>,
): MealSlotDatum[] {
  return (["breakfast", "lunch", "dinner"] as const).map((slot) => ({
    slot,
    labelTh: MEAL_SLOT_LABELS_TH[slot],
    target: slotTotals[slot].target,
    actual: slotTotals[slot].actual,
  }));
}

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
  if (!active || !payload?.length) return null;

  return (
    <div className="neu-raised-sm px-4 py-2 text-sm">
      <p className="mb-1 font-semibold text-neu-ink">{label}</p>
      {payload.map((entry) => (
        <p key={String(entry.dataKey ?? entry.name)} style={{ color: entry.color }}>
          {entry.name}: {entry.value}g
        </p>
      ))}
    </div>
  );
}

export function FeedHistoryChart({ data }: { data: MealSlotDatum[] }) {
  return (
    <NeuCard>
      <h2 className="mb-4 text-sm font-semibold text-neu-ink-muted">
        มื้ออาหารวันนี้
      </h2>
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4}>
            <XAxis
              dataKey="labelTh"
              stroke="var(--neu-ink-muted)"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--neu-ink-muted)"
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <Tooltip content={ChartTooltip} cursor={{ fill: "var(--neu-dark)", opacity: 0.2 }} />
            <Bar
              dataKey="target"
              name="เป้าหมาย"
              fill="var(--neu-dark)"
              radius={[8, 8, 0, 0]}
            />
            <Bar
              dataKey="actual"
              name="กินจริง"
              fill="var(--neu-accent)"
              radius={[8, 8, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </NeuCard>
  );
}
