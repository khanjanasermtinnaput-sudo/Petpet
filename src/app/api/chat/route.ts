import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPet } from "@/lib/device";

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequestBody {
  messages?: ChatTurn[];
}

function buildSystemPrompt(
  pet: {
    name: string;
    species: string;
    age_years: number;
    age_months: number;
    weight_kg: number;
    daily_target_g: number;
  },
  feedHistorySummary: string,
): string {
  return `คุณคือ AI สัตวแพทย์ผู้ช่วยในแอปเครื่องให้อาหารสัตว์เลี้ยงอัจฉริยะ "Petpet"

ข้อมูลสัตว์เลี้ยง:
- ชื่อ: ${pet.name}
- ชนิด/สายพันธุ์: ${pet.species}
- อายุ: ${pet.age_years} ปี ${pet.age_months} เดือน
- น้ำหนัก: ${pet.weight_kg} กก.
- เป้าหมายอาหารต่อวัน: ${pet.daily_target_g} กรัม

ประวัติการให้อาหารใน 24 ชั่วโมงที่ผ่านมา:
${feedHistorySummary}

ตอบคำถามของเจ้าของโดยอ้างอิงข้อมูลข้างต้นเมื่อเกี่ยวข้อง ให้คำแนะนำเบื้องต้นอย่างเป็นมิตรและกระชับ
คุณไม่ใช่สัตวแพทย์ตัวจริงและไม่สามารถวินิจฉัยหรือสั่งยาได้ — แนะนำให้พาไปพบสัตวแพทย์จริงหากมีอาการที่น่าเป็นห่วง`;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ยังไม่ได้ตั้งค่า ANTHROPIC_API_KEY บนเซิร์ฟเวอร์" },
      { status: 500 },
    );
  }

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages;
  if (!messages?.length) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  const pet = await getPet(supabase);

  if (!pet) {
    return NextResponse.json({ error: "ไม่พบข้อมูลสัตว์เลี้ยง" }, { status: 404 });
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentFeedEvents } = await supabase
    .from("feed_events")
    .select("meal_slot, target_g, actual_eaten_g, ts")
    .eq("device_id", pet.device_id)
    .gte("ts", since)
    .order("ts", { ascending: true });

  const feedHistorySummary =
    recentFeedEvents && recentFeedEvents.length > 0
      ? recentFeedEvents
          .map((e) => `- ${e.meal_slot} @ ${e.ts}: เป้าหมาย ${e.target_g}g, กินจริง ${e.actual_eaten_g}g`)
          .join("\n")
      : "ไม่มีข้อมูลการให้อาหารใน 24 ชั่วโมงที่ผ่านมา";

  const anthropic = new Anthropic({ apiKey });
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const anthropicStream = anthropic.messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 1024,
          system: buildSystemPrompt(pet, feedHistorySummary),
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        });

        anthropicStream.on("text", (textDelta) => {
          controller.enqueue(encoder.encode(textDelta));
        });

        await anthropicStream.finalMessage();
      } catch (err) {
        const message = err instanceof Error ? err.message : "เกิดข้อผิดพลาดจาก AI สัตวแพทย์";
        controller.enqueue(encoder.encode(`\n\n[error] ${message}`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
