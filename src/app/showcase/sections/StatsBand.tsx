/**
 * `data-count-to` / `data-count-suffix` are read by the GSAP counter in
 * ShowcaseClient. The rendered text is the final value so the section is
 * correct with JS disabled or motion reduced.
 */
const STATS = [
  { value: 12480, suffix: "", decimals: 0, label: "มื้อที่เทอัตโนมัติ", note: "จากผู้ใช้ช่วงทดลอง" },
  { value: 98.6, suffix: "%", decimals: 1, label: "ความแม่นยำการชั่ง", note: "เทียบกับตาชั่งดิจิทัล" },
  { value: 3.2, suffix: " วิ", decimals: 1, label: "เวลาเฉลี่ยต่อการเท", note: "ตั้งแต่สั่งจนอาหารลงถาด" },
  { value: 24, suffix: "/7", decimals: 0, label: "UV-C ฆ่าเชื้อในถาด", note: "ทำงานรอบอัตโนมัติ" },
] as const;

function format(value: number, decimals: number) {
  return value.toLocaleString("th-TH", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function StatsBand() {
  return (
    <section className="reveal-section px-6 py-28">
      <div className="mx-auto max-w-6xl rounded-[2rem] border border-white/8 bg-[var(--showcase-panel)] px-8 py-14 sm:px-14">
        <h2 className="mb-12 max-w-xl text-[clamp(1.6rem,3.4vw,2.4rem)] font-bold leading-tight">
          ตัวเลขจากการใช้งานจริง
        </h2>

        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label}>
              <p
                className="stat-value text-[clamp(2.2rem,5vw,3.2rem)] font-bold leading-none tracking-tight text-[var(--showcase-accent)]"
                data-count-to={s.value}
                data-count-decimals={s.decimals}
                data-count-suffix={s.suffix}
              >
                {format(s.value, s.decimals)}
                {s.suffix}
              </p>
              <p className="mt-3 font-semibold text-[var(--showcase-ink)]">{s.label}</p>
              <p className="mt-1 text-sm text-[var(--showcase-ink-muted)]">{s.note}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
