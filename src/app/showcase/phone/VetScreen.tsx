import { Screen } from "./ScreenChrome";

// Mirrors ChatMessage: neu-raised-sm bubbles, user right-aligned in accent.
const MESSAGES: { role: "user" | "assistant"; content: string }[] = [
  {
    role: "assistant",
    content: "สวัสดีค่ะ 🐾 วันนี้มะลิกินไป 320g จาก 450g ที่ตั้งไว้ มีอะไรให้ช่วยดูไหมคะ",
  },
  { role: "user", content: "มะลิกินน้อยลงสองวันแล้ว ปกติไหมคะ" },
  {
    role: "assistant",
    content:
      "จากประวัติ 7 วัน มะลิกินลดลงราว 12% ค่ะ ถ้ายังร่าเริงและขับถ่ายปกติ มักไม่น่ากังวล อาจเป็นเพราะอากาศร้อน ลองสังเกตต่ออีก 1–2 วันนะคะ",
  },
  { role: "user", content: "ถ้ายังกินน้อยอยู่ควรทำยังไงดี" },
  {
    role: "assistant",
    content:
      "ลองแบ่งเป็นมื้อเล็ก 4 มื้อแทน 3 มื้อดูก่อนนะคะ แล้วเช็กว่าอาหารไม่ชื้น ถ้าเกิน 3 วันแล้วยังกินน้อยกว่า 70% ของเป้าหมาย แนะนำให้พาไปพบสัตวแพทย์ค่ะ",
  },
];

export function VetScreen() {
  return (
    <Screen active={2}>
      <header className="flex items-center gap-2 px-4 py-3">
        <span className="neu-raised-round flex h-8 w-8 items-center justify-center text-sm" aria-hidden>
          💬
        </span>
        <div>
          <h1 className="text-sm font-bold text-neu-ink">AI สัตวแพทย์</h1>
          <p className="text-[9px] text-neu-ink-muted">รู้จักพฤติกรรมการกินของมะลิ</p>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-2 overflow-hidden px-3">
        {MESSAGES.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <p
              className={`neu-raised-sm max-w-[80%] px-3 py-2 text-[11px] leading-relaxed ${
                m.role === "user" ? "text-neu-accent" : "text-neu-ink"
              }`}
            >
              {m.content}
            </p>
          </div>
        ))}
      </div>

      {/* ChatInput */}
      <div className="flex shrink-0 items-center gap-2 px-3 py-3">
        <span className="neu-inset flex-1 px-3 py-2 text-[11px] text-neu-ink-muted">
          พิมพ์คำถามเกี่ยวกับน้อง...
        </span>
        <span className="neu-raised-round flex h-9 w-9 items-center justify-center text-sm text-neu-accent">
          ➤
        </span>
      </div>
    </Screen>
  );
}
