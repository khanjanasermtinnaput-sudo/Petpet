import { PhoneFrame } from "../phone/PhoneFrame";
import { DashboardScreen } from "../phone/DashboardScreen";

export function Hero() {
  return (
    <section className="hero relative flex min-h-screen items-center overflow-hidden px-6 py-24">
      {/* Farthest layer — travels most during parallax. Kept at z-0 rather
          than -z-10: a negative index would drop it behind .showcase-root's
          own background and disappear. */}
      <div
        className="hero-glow pointer-events-none absolute left-1/2 top-1/3 z-0 h-[900px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full"
        style={{
          // No blur filter: the radial gradient is already soft, and stacking a
          // 110px blur on top flattened the peak alpha to nearly nothing (and
          // is expensive to repaint on every parallax frame).
          background:
            "radial-gradient(circle, rgba(123,110,246,.40) 0%, rgba(123,110,246,.18) 35%, rgba(123,110,246,.05) 55%, transparent 72%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-14 md:grid-cols-2">
        <div className="hero-text-col">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.04] px-4 py-1.5 text-[13px] font-semibold text-[var(--showcase-ink-muted)] backdrop-blur">
            <span className="h-2 w-2 rounded-full bg-[var(--showcase-accent)] shadow-[0_0_10px_var(--showcase-accent)]" />
            พาชมการใช้งาน · Petpet
          </span>

          <h1 className="mt-6 text-[clamp(2.6rem,6vw,4.4rem)] font-bold leading-[1.08] tracking-tight">
            ให้อาหารน้อง
            <br />
            <span className="text-[var(--showcase-accent)]">แม่นทุกกรัม</span>
            <br />
            แม้คุณไม่อยู่บ้าน
          </h1>

          <p className="mt-6 max-w-md text-lg leading-relaxed text-[var(--showcase-ink-muted)]">
            เครื่องให้อาหารอัจฉริยะที่ชั่งน้ำหนักอาหารในถาดแบบเรียลไทม์ ฆ่าเชื้อด้วย UV-C
            และมี AI สัตวแพทย์คอยดูพฤติกรรมการกินของน้องให้ตลอด 24 ชั่วโมง
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <a
              href="#feature-showcase"
              className="cta-button rounded-2xl bg-[var(--showcase-accent)] px-7 py-3.5 font-semibold text-white shadow-[0_10px_30px_-8px_rgba(123,110,246,.8)]"
            >
              ดูฟีเจอร์ในแอป
            </a>
            <a
              href="/onboarding"
              className="cta-button rounded-2xl border border-white/12 px-7 py-3.5 font-semibold text-[var(--showcase-ink)]"
            >
              เริ่มต้นใช้งาน
            </a>
          </div>
        </div>

        {/* Nearest layer — travels least. */}
        <div className="hero-phone flex justify-center md:justify-end">
          <PhoneFrame>
            <DashboardScreen />
          </PhoneFrame>
        </div>
      </div>

      <span className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[13px] text-[var(--showcase-ink-muted)]">
        เลื่อนลงเพื่อดูแอป ↓
      </span>
    </section>
  );
}
