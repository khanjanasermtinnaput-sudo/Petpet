import { PhoneFrame } from "../phone/PhoneFrame";
import { DashboardScreen } from "../phone/DashboardScreen";
import { HistoryScreen } from "../phone/HistoryScreen";
import { VetScreen } from "../phone/VetScreen";
import { OnboardingScreen } from "../phone/OnboardingScreen";

const FEATURES = [
  {
    step: "01",
    title: "รู้ทันทีว่าเหลืออาหารเท่าไหร่",
    body: "โหลดเซลล์ใต้ถาดชั่งน้ำหนักตลอดเวลา วงแหวนบนหน้าหลักบอกเป็นกรัมว่าน้องกินไปแล้วเท่าไหร่จากเป้าหมายวันนี้ ไม่ต้องเดาอีกต่อไป",
  },
  {
    step: "02",
    title: "ย้อนดูได้ทุกมื้อ 7 วัน",
    body: "กราฟแยกสีมื้อเช้า กลางวัน เย็น ให้เห็นทันทีว่าวันไหนน้องกินน้อยผิดปกติ และช่วงเวลาไหนที่น้องกินดีที่สุด",
  },
  {
    step: "03",
    title: "ถาม AI สัตวแพทย์ได้ทุกเมื่อ",
    body: "AI อ่านประวัติการกินจริงของน้องก่อนตอบทุกครั้ง ถามเป็นภาษาไทยได้เลยว่ากินน้อยลงแบบนี้ผิดปกติไหม ควรทำอะไรต่อ",
  },
  {
    step: "04",
    title: "ตั้งค่าเสร็จใน 30 วินาที",
    body: "กรอกชื่อ ชนิด วันเกิด และน้ำหนักของน้อง แค่นั้น Petpet คำนวณปริมาณอาหารที่เหมาะสมต่อวันให้อัตโนมัติ",
  },
] as const;

export function FeatureShowcase() {
  return (
    <>
      {/* Heading is outside the pinned section — a pinned section must fit
          inside one viewport, and this would push the phone off-screen. */}
      <section className="reveal-section px-6 pb-4 pt-28">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-[.2em] text-[var(--showcase-accent)]">
            ภายในแอป
          </p>
          <h2 className="mt-3 max-w-2xl text-[clamp(2rem,4.5vw,3.2rem)] font-bold leading-tight">
            สี่หน้าจอ ที่คนเลี้ยงสัตว์ใช้จริงทุกวัน
          </h2>
        </div>
      </section>

      <section id="feature-showcase" className="relative flex min-h-screen items-center px-6 py-10">
        <div className="mx-auto w-full max-w-6xl">
          <div className="grid items-center gap-10 md:grid-cols-[1fr_auto] md:gap-20">
            {/* Desktop: a fixed-height window; #feature-list slides inside it,
                driven by the same timeline that swaps the phone screens, so
                text and screen can never drift apart.
                Mobile: no window, blocks just stack and the page scrolls. */}
            <div id="feature-window" className="order-2 md:order-1">
              <div id="feature-list">
                {FEATURES.map((f) => (
                  <article key={f.step} className="feature-block">
                    <div>
                      <span className="text-sm font-bold tracking-[.2em] text-[var(--showcase-accent)]">
                        {f.step}
                      </span>
                      <h3 className="mt-2 text-[clamp(1.4rem,2.6vw,2rem)] font-bold leading-snug">
                        {f.title}
                      </h3>
                      <p className="mt-3 max-w-md leading-relaxed text-[var(--showcase-ink-muted)]">
                        {f.body}
                      </p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div id="phone-mockup-sticky" className="order-1 flex justify-center md:order-2">
              {/* scale() does not shrink the layout box, so the wrapper is
                  height-capped to match below the pin breakpoint. */}
              <div className="h-[400px] md:h-auto">
                <PhoneFrame className="origin-top scale-[.6] md:scale-100">
                  <div className="phone-screen-stack h-full">
                    <div className="phone-screen-view">
                      <DashboardScreen />
                    </div>
                    <div className="phone-screen-view">
                      <HistoryScreen />
                    </div>
                    <div className="phone-screen-view">
                      <VetScreen />
                    </div>
                    <div className="phone-screen-view">
                      <OnboardingScreen />
                    </div>
                  </div>
                </PhoneFrame>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
