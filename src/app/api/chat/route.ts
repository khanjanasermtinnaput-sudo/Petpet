import { GoogleGenAI } from "@google/genai";
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

function isChatTurn(value: unknown): value is ChatTurn {
  if (!value || typeof value !== "object") return false;
  const turn = value as Record<string, unknown>;
  return (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string" && turn.content.trim().length > 0;
}

function buildSystemPrompt(pet: { name: string; species: string; breed: string; age_years: number; age_months: number; weight_kg: number; daily_target_g: number }, feedHistorySummary: string) {
  return `คุณคือ AI สัตวแพทย์ผู้ช่วยในแอป Petpet

ข้อมูลสัตว์เลี้ยง:
- ชื่อ: ${pet.name}
- ชนิด: ${pet.species === "Cat" ? "แมว" : "สุนัข"}
- สายพันธุ์: ${pet.breed || "ไม่ระบุ"}
- อายุ: ${pet.age_years} ปี ${pet.age_months} เดือน
- น้ำหนัก: ${pet.weight_kg} กก.
- เป้าหมายอาหารต่อวัน: ${pet.daily_target_g} กรัม

ประวัติการให้อาหาร 24 ชั่วโมงล่าสุด:
${feedHistorySummary}

ตอบภาษาไทยให้กระชับ อ่อนโยน และใช้งานได้จริง ระบุสัญญาณอันตรายที่ควรพบสัตวแพทย์ทันทีเสมอเมื่อเกี่ยวข้อง คุณไม่ใช่สัตวแพทย์ตัวจริง ห้ามวินิจฉัยหรือสั่งยาแทนผู้เชี่ยวชาญ`;
}

async function saveMessage(supabase: Awaited<ReturnType<typeof createClient>>, petId: string, message: ChatTurn) {
  const { error } = await supabase.from("vet_chat_messages").insert({ pet_id: petId, role: message.role, content: message.content });
  if (error) console.error("[chat] failed to persist message", { code: error.code });
}

export async function GET() {
  const supabase = await createClient();
  const pet = await getPet(supabase);
  if (!pet) return NextResponse.json({ pet: null, messages: [] });

  const { data, error } = await supabase
    .from("vet_chat_messages")
    .select("id, role, content, created_at")
    .eq("pet_id", pet.id)
    .order("created_at", { ascending: true })
    .limit(100);

  if (error) return NextResponse.json({ error: "โหลดประวัติแชตไม่สำเร็จ" }, { status: 503 });
  return NextResponse.json({ pet: { name: pet.name, species: pet.species, breed: pet.breed }, messages: data ?? [] });
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์" }, { status: 500 });

  let body: ChatRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const messages = body.messages?.filter(isChatTurn).slice(-20);
  if (!messages?.length || messages[messages.length - 1].role !== "user") {
    return NextResponse.json({ error: "messages must end with a user message" }, { status: 400 });
  }

  const supabase = await createClient();
  const pet = await getPet(supabase);
  if (!pet) return NextResponse.json({ error: "ไม่พบข้อมูลสัตว์เลี้ยง" }, { status: 404 });

  const latestUserMessage = messages[messages.length - 1];
  await saveMessage(supabase, pet.id, latestUserMessage);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data: recentFeedEvents } = await supabase
    .from("feed_events")
    .select("meal_slot, target_g, actual_eaten_g, ts")
    .eq("device_id", pet.device_id)
    .gte("ts", since)
    .order("ts", { ascending: true });
  const feedHistorySummary = recentFeedEvents?.length
    ? recentFeedEvents.map((event) => `- ${event.meal_slot} @ ${event.ts}: เป้าหมาย ${event.target_g}g, กินจริง ${event.actual_eaten_g}g`).join("\n")
    : "ไม่มีข้อมูลการให้อาหารใน 24 ชั่วโมงที่ผ่านมา";

  const ai = new GoogleGenAI({ apiKey });
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let assistantContent = "";
      try {
        const geminiStream = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          config: { maxOutputTokens: 1024, systemInstruction: buildSystemPrompt(pet, feedHistorySummary) },
          contents: messages.map((message) => ({ role: message.role === "assistant" ? "model" : "user", parts: [{ text: message.content }] })),
        });

        for await (const chunk of geminiStream) {
          if (!chunk.text) continue;
          assistantContent += chunk.text;
          controller.enqueue(encoder.encode(chunk.text));
        }
        if (assistantContent) await saveMessage(supabase, pet.id, { role: "assistant", content: assistantContent });
      } catch (error) {
        const fallback = "ขออภัยค่ะ ระบบ AI ขัดข้องชั่วคราว หากน้องมีอาการฉุกเฉินกรุณาติดต่อสัตวแพทย์ทันที";
        controller.enqueue(encoder.encode(fallback));
        console.error("[chat] generation failed", error);
        await saveMessage(supabase, pet.id, { role: "assistant", content: fallback });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
