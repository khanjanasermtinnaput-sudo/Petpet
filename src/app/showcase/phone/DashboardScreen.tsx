import { Screen } from "./ScreenChrome";

const SIZE = 158;
const STROKE = 14;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

const VALUE_G = 320;
const TARGET_G = 450;

/** Mirrors NeuProgressRing — rotated SVG, muted track + accent arc. */
function ProgressRing() {
  const pct = Math.min(1, Math.max(0, VALUE_G / TARGET_G));

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
    >
      <svg width={SIZE} height={SIZE} className="-rotate-90">
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--neu-dark)"
          strokeOpacity={0.5}
          strokeWidth={STROKE}
        />
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke="var(--neu-accent)"
          strokeWidth={STROKE}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - pct)}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-neu-ink">{VALUE_G}g</span>
        <span className="text-xs text-neu-ink-muted">/{TARGET_G}g</span>
      </div>
    </div>
  );
}

export function DashboardScreen() {
  return (
    <Screen active={0}>
      {/* TopBar — paw avatar, pet name, UV pill */}
      <header className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="neu-raised-round flex h-9 w-9 items-center justify-center text-base" aria-hidden>
            🐾
          </span>
          <span className="text-base font-bold text-neu-ink">มะลิ</span>
        </div>
        <span className="neu-raised-sm flex items-center gap-1.5 px-2.5 py-1.5">
          <span
            className="h-2 w-2 rounded-full bg-neu-accent shadow-[0_0_8px_var(--neu-accent)]"
            aria-hidden
          />
          <span className="text-[10px] font-semibold text-neu-ink">UV กำลังฆ่าเชื้อ</span>
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-3 px-4">
        {/* LowEatingAlert */}
        <div className="neu-raised-sm flex items-center justify-between gap-3 border-l-4 border-neu-warning px-3 py-2.5">
          <div>
            <p className="text-[11px] font-semibold text-neu-warning">
              น้องกินน้อยกว่าปกติในมื้อนี้
            </p>
            <span className="mt-0.5 inline-block text-[10px] font-semibold text-neu-accent underline underline-offset-2">
              ถาม AI สัตวแพทย์
            </span>
          </div>
          <span className="shrink-0 text-neu-ink-muted" aria-hidden>
            ✕
          </span>
        </div>

        {/* TrayHeroCard */}
        <div className="neu-raised flex flex-col items-center gap-2 px-4 py-5">
          <h2 className="text-[11px] font-semibold text-neu-ink-muted">อาหารในถาดตอนนี้</h2>
          <ProgressRing />
        </div>

        {/* ManualFeedButton (FAB). The app uses a 🍽️ emoji; drawn as SVG here
            because emoji coverage varies by platform and this is the one
            control the whole screen points at. */}
        <div className="flex justify-center pb-2">
          <span className="neu-raised-round flex h-14 w-14 items-center justify-center text-neu-accent">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M3.5 11h17a8.5 8.5 0 0 1-17 0Z"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinejoin="round"
              />
              <path
                d="M9 6.2c0-1 .8-1.7 1.5-2.2M13 6.2c0-1 .8-1.7 1.5-2.2"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path d="M2 20.5h20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
            </svg>
          </span>
        </div>
      </div>
    </Screen>
  );
}
