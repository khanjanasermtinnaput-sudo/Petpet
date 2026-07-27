const REVIEWS = [
  {
    name: "ณิชา",
    pet: "เจ้าโมจิ · แมวสก็อตติช",
    stars: 5,
    body: "ทำงานกะดึกแล้วไม่ต้องกังวลเลยค่ะ เปิดแอปดูวงแหวนก็รู้ว่าโมจิกินไปกี่กรัมแล้ว จากเดิมที่ได้แค่เดาว่าชามหมดหรือยัง",
  },
  {
    name: "กฤต",
    pet: "เจ้าบุญมี · โกลเด้น",
    stars: 5,
    body: "ชอบกราฟ 7 วันมาก เห็นเลยว่าบุญมีกินน้อยลงตั้งแต่วันพุธ พาไปหาหมอทัน ปรากฏว่าฟันมีปัญหาจริง ๆ ถ้าไม่มีกราฟนี้คงไม่ทันสังเกต",
  },
  {
    name: "พิมพ์ชนก",
    pet: "เจ้าถั่วเขียว · แมวไทย",
    stars: 4,
    body: "ถาม AI สัตวแพทย์ตอนตีสองได้ ตอบไทยชัดเจนและอ้างอิงประวัติการกินของถั่วเขียวจริง ๆ ไม่ใช่ตอบกว้าง ๆ แบบที่เคยเจอ",
  },
  {
    name: "อนุชา",
    pet: "เจ้าข้าวปั้น · ชิบะ",
    stars: 5,
    body: "ตั้งค่าครั้งแรกใช้เวลาไม่ถึงนาที กรอกแค่ชื่อ วันเกิด น้ำหนัก แล้วมันคำนวณปริมาณต่อวันให้เอง ไม่ต้องนั่งหาข้อมูลเอง",
  },
  {
    name: "สุธาสินี",
    pet: "เจ้ามินิ · ปอมเมอเรเนียน",
    stars: 5,
    body: "หลอด UV ทำงานทุกรอบหลังกินเสร็จ ถาดไม่มีกลิ่นติดเหมือนเครื่องเก่าเลย ล้างง่ายขึ้นเยอะค่ะ",
  },
  {
    name: "ธีรภัทร",
    pet: "เจ้าโอปอล์ · แมวเปอร์เซีย",
    stars: 4,
    body: "แจ้งเตือนตอนกินน้อยกว่าปกติแม่นดี กดจากการแจ้งเตือนไปถาม AI ต่อได้เลยในหน้าเดียว ไม่ต้องเล่าประวัติซ้ำ",
  },
] as const;

function Stars({ n }: { n: number }) {
  return (
    <span className="text-sm tracking-[.15em] text-[#f2994a]" aria-label={`${n} จาก 5 ดาว`}>
      {"★".repeat(n)}
      <span className="text-white/15">{"★".repeat(5 - n)}</span>
    </span>
  );
}

export function Reviews() {
  return (
    <section className="px-6 pb-28">
      <div className="mx-auto max-w-6xl">
        <div className="reveal-section mb-14 max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-[.2em] text-[var(--showcase-accent)]">
            เสียงจากผู้ใช้
          </p>
          <h2 className="mt-3 text-[clamp(2rem,4.5vw,3.2rem)] font-bold leading-tight">
            คนเลี้ยงสัตว์เขาว่ายังไงกันบ้าง
          </h2>
        </div>

        {/* Masonry via CSS columns — cards keep their natural height. */}
        <div className="columns-1 gap-6 sm:columns-2 lg:columns-3 [&>*]:mb-6">
          {REVIEWS.map((r) => (
            <article
              key={r.name}
              className="review-card reveal-section break-inside-avoid rounded-3xl border border-white/8 bg-[var(--showcase-panel)] p-7"
            >
              <Stars n={r.stars} />
              <p className="mt-4 leading-relaxed text-[var(--showcase-ink)]">{r.body}</p>
              <div className="mt-6 flex items-center gap-3 border-t border-white/8 pt-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--showcase-accent)]/15 text-lg" aria-hidden>
                  🐾
                </span>
                <span>
                  <span className="block font-semibold text-[var(--showcase-ink)]">{r.name}</span>
                  <span className="block text-sm text-[var(--showcase-ink-muted)]">{r.pet}</span>
                </span>
              </div>
            </article>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-[var(--showcase-ink-muted)]">
          รีวิวข้างต้นเป็นตัวอย่างประกอบการออกแบบหน้าเว็บ ไม่ใช่คำรับรองจากผู้ใช้จริง
        </p>
      </div>
    </section>
  );
}
