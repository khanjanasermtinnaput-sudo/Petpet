import { Screen } from "./ScreenChrome";

// Same series colors and Thai labels as WeeklyFeedChart.
const SERIES = [
  { key: "breakfast", label: "เช้า", color: "var(--neu-accent)" },
  { key: "lunch", label: "กลางวัน", color: "var(--neu-warning)" },
  { key: "dinner", label: "เย็น", color: "var(--neu-ink-muted)" },
] as const;

const DATA: { day: string; values: [number, number, number] }[] = [
  { day: "จ", values: [140, 120, 150] },
  { day: "อ", values: [150, 135, 145] },
  { day: "พ", values: [130, 110, 140] },
  { day: "พฤ", values: [145, 130, 150] },
  { day: "ศ", values: [150, 140, 148] },
  { day: "ส", values: [120, 95, 130] },
  { day: "อา", values: [135, 125, 142] },
];

const MAX = 160;
const TICKS = [160, 120, 80, 40, 0];

export function HistoryScreen() {
  return (
    <Screen active={1}>
      <header className="px-4 py-3">
        <h1 className="text-base font-bold text-neu-ink">ประวัติการกิน</h1>
      </header>

      <div className="flex-1 px-4">
        <div className="neu-raised px-3 py-4">
          <h2 className="mb-3 text-[11px] font-semibold text-neu-ink-muted">
            ปริมาณอาหารที่กินย้อนหลัง 7 วัน
          </h2>

          <div className="flex gap-1.5">
            {/* Y axis */}
            <div className="flex h-[180px] w-6 shrink-0 flex-col justify-between text-right text-[9px] text-neu-ink-muted">
              {TICKS.map((t) => (
                <span key={t}>{t}</span>
              ))}
            </div>

            {/* grouped bars */}
            <div className="flex h-[180px] flex-1 items-end justify-between gap-1">
              {DATA.map((d) => (
                <div key={d.day} className="flex h-full flex-1 flex-col justify-end gap-1">
                  <div className="flex h-full items-end justify-center gap-[2px]">
                    {d.values.map((v, i) => (
                      <span
                        key={SERIES[i].key}
                        className="w-[5px] rounded-t-md"
                        style={{
                          height: `${(v / MAX) * 100}%`,
                          background: SERIES[i].color,
                        }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* X axis */}
          <div className="mt-1.5 flex gap-1.5">
            <span className="w-6 shrink-0" />
            <div className="flex flex-1 justify-between gap-1">
              {DATA.map((d) => (
                <span
                  key={d.day}
                  className="flex-1 text-center text-[9px] text-neu-ink-muted"
                >
                  {d.day}
                </span>
              ))}
            </div>
          </div>

          {/* Legend */}
          <div className="mt-3 flex justify-center gap-3">
            {SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-1 text-[9px] text-neu-ink-muted">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: s.color }}
                  aria-hidden
                />
                {s.label}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-col gap-2">
          <div className="neu-raised-sm flex items-center justify-between px-3 py-2.5">
            <span className="text-[11px] text-neu-ink-muted">เฉลี่ยต่อวัน</span>
            <span className="text-sm font-bold text-neu-ink">402g</span>
          </div>
          <div className="neu-raised-sm flex items-center justify-between px-3 py-2.5">
            <span className="text-[11px] text-neu-ink-muted">มื้อที่เทสัปดาห์นี้</span>
            <span className="text-sm font-bold text-neu-ink">21 มื้อ</span>
          </div>
          <div className="neu-raised-sm flex items-center justify-between px-3 py-2.5">
            <span className="text-[11px] text-neu-ink-muted">วันที่กินน้อยที่สุด</span>
            <span className="text-sm font-bold text-neu-warning">เสาร์ · 345g</span>
          </div>
        </div>
      </div>
    </Screen>
  );
}
