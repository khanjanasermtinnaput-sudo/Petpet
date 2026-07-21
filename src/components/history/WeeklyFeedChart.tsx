"use client";

import {
  Bar,
  BarChart,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { NeuCard } from "@/components/neu/NeuCard";

export interface DailyMealDatum {
  dateLabel: string;
  breakfast: number;
  lunch: number;
  dinner: number;
}

const SERIES_LABELS_TH: Record<"breakfast" | "lunch" | "dinner", string> = {
  breakfast: "เช้า",
  lunch: "กลางวัน",
  dinner: "เย็น",
};

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

export function WeeklyFeedChart({ data }: { data: DailyMealDatum[] }) {
  return (
    <NeuCard>
      <h2 className="mb-4 text-sm font-semibold text-neu-ink-muted">
        ปริมาณอาหารที่กินย้อนหลัง 7 วัน
      </h2>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barGap={4}>
            <XAxis
              dataKey="dateLabel"
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
            <Legend
              formatter={(value) =>
                SERIES_LABELS_TH[value as keyof typeof SERIES_LABELS_TH] ?? value
              }
            />
            <Bar dataKey="breakfast" name={SERIES_LABELS_TH.breakfast} fill="var(--neu-accent)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="lunch" name={SERIES_LABELS_TH.lunch} fill="var(--neu-warning)" radius={[6, 6, 0, 0]} />
            <Bar dataKey="dinner" name={SERIES_LABELS_TH.dinner} fill="var(--neu-ink-muted)" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </NeuCard>
  );
}
