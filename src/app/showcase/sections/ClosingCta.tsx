import Link from "next/link";

export function ClosingCta() {
  return (
    <section className="relative overflow-hidden px-6 pb-32 pt-8">
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[820px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(123,110,246,.32) 0%, rgba(123,110,246,.14) 38%, rgba(123,110,246,.04) 58%, transparent 74%)",
        }}
        aria-hidden
      />

      <div className="reveal-section relative z-10 mx-auto max-w-3xl text-center">
        <h2 className="text-[clamp(2.2rem,5.5vw,3.6rem)] font-bold leading-tight">
          ให้ Petpet ดูแลมื้ออาหารของน้อง
        </h2>
        <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-[var(--showcase-ink-muted)]">
          เริ่มต้นด้วยการกรอกข้อมูลน้องแค่ 4 ช่อง แล้วปล่อยให้เครื่องกับ AI
          จัดการเรื่องอาหารและความสะอาดให้คุณ
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link
            href="/onboarding"
            className="cta-button rounded-2xl bg-[var(--showcase-accent)] px-9 py-4 font-semibold text-white shadow-[0_14px_36px_-10px_rgba(123,110,246,.9)]"
          >
            เริ่มตั้งค่าน้อง
          </Link>
          <Link
            href="/dashboard"
            className="cta-button rounded-2xl border border-white/12 px-9 py-4 font-semibold text-[var(--showcase-ink)]"
          >
            เข้าสู่แอป
          </Link>
        </div>

        <p className="mt-16 text-sm text-[var(--showcase-ink-muted)]">
          Petpet · เครื่องให้อาหารสัตว์เลี้ยงอัจฉริยะ 🐾
        </p>
      </div>
    </section>
  );
}
