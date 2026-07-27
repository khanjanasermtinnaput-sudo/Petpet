import { StatusBar } from "./ScreenChrome";

// Field labels match src/app/onboarding/page.tsx exactly.
const FIELDS = [
  { label: "ชื่อสัตว์เลี้ยง", value: "มะลิ" },
  { label: "ชนิดสัตว์เลี้ยง", value: "แมว", caret: true },
  { label: "วันเดือนปีเกิด", value: "12 / 03 / 2565" },
  { label: "น้ำหนัก (กก.)", value: "4.2" },
] as const;

export function OnboardingScreen() {
  return (
    <div className="flex h-full flex-col bg-neu-bg font-display">
      <StatusBar />

      {/* Onboarding is a single centered NeuCard — no nav rail. */}
      <div className="flex flex-1 items-center justify-center px-4">
        <div className="neu-raised w-full px-5 py-6">
          <h1 className="mb-1 text-center text-xl font-bold text-neu-ink">Petpet 🐾</h1>
          <p className="mb-5 text-center text-[11px] text-neu-ink-muted">
            กรอกข้อมูลน้องสัตว์เลี้ยงของคุณ
          </p>

          <div className="flex flex-col gap-3">
            {FIELDS.map((f) => (
              <label key={f.label} className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold text-neu-ink-muted">{f.label}</span>
                <span className="neu-inset flex items-center justify-between px-3 py-2 text-[11px] text-neu-ink">
                  {f.value}
                  {"caret" in f && f.caret ? (
                    <span className="text-neu-ink-muted" aria-hidden>
                      ▾
                    </span>
                  ) : null}
                </span>
              </label>
            ))}

            <span className="neu-raised-sm mt-2 block px-4 py-2.5 text-center text-[12px] font-semibold text-neu-accent">
              เริ่มต้นใช้งาน
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
