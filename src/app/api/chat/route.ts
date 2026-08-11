import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { getChatContext } from "@/lib/chat-context";
import { createClient } from "@/lib/supabase/server";
import { buildVetSystemPrompt, CHAT_MESSAGE_MAX_LENGTH, conversationTitle, isUuid, type VetChatRole } from "@/lib/vet-chat";

type ChatRequestBody = {
  conversationId?: unknown;
  message?: unknown;
  clientMessageId?: unknown;
};

type StreamEvent =
  | { type: "conversation"; conversation: { id: string; title: string; created_at: string; updated_at: string } }
  | { type: "chunk"; text: string }
  | { type: "complete" }
  | { type: "error"; message: string };

function eventLine(event: StreamEvent): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(event)}\n`);
}

function userFacingError(error: unknown): string {
  if (error instanceof Error && error.message.includes("GEMINI")) {
    return "VET AI ยังไม่พร้อมใช้งาน กรุณาลองใหม่อีกครั้ง";
  }
  return "VET AI ตอบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY บนเซิร์ฟเวอร์" }, { status: 500 });

  let body: ChatRequestBody;
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return NextResponse.json({ error: "JSON body must be an object" }, { status: 400 });
    }
    body = parsed as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message || message.length > CHAT_MESSAGE_MAX_LENGTH) {
    return NextResponse.json({ error: `message must be between 1 and ${CHAT_MESSAGE_MAX_LENGTH} characters` }, { status: 400 });
  }
  if (!isUuid(body.clientMessageId)) return NextResponse.json({ error: "clientMessageId must be a UUID" }, { status: 400 });
  if (body.conversationId !== undefined && !isUuid(body.conversationId)) {
    return NextResponse.json({ error: "conversationId must be a UUID" }, { status: 400 });
  }

  const context = await getChatContext();
  if (!context) return NextResponse.json({ error: "ต้องเริ่ม session ของ VET AI ก่อน" }, { status: 401 });

  let conversationId: string;
  let conversationTitleText: string;
  let conversationCreatedAt: string;
  let conversationUpdatedAt: string;
  if (body.conversationId) {
    const { data: conversation, error } = await context.chatClient
      .from("chat_conversations")
      .select("id, pet_id, title, created_at, updated_at")
      .eq("id", body.conversationId)
      .maybeSingle();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!conversation) return NextResponse.json({ error: "ไม่พบแชท" }, { status: 404 });
    if (conversation.pet_id !== context.pet.id) {
      return NextResponse.json({ error: "แชทนี้ไม่ได้เป็นของสัตว์เลี้ยงที่เลือกอยู่" }, { status: 403 });
    }
    conversationId = conversation.id;
    conversationTitleText = conversation.title;
    conversationCreatedAt = conversation.created_at;
    conversationUpdatedAt = conversation.updated_at;
  } else {
    const { data: conversation, error } = await context.chatClient
      .from("chat_conversations")
      .insert({ pet_id: context.pet.id, title: conversationTitle(message) })
      .select("id, title, created_at, updated_at")
      .single();
    if (error || !conversation) return NextResponse.json({ error: error?.message ?? "สร้างแชทไม่สำเร็จ" }, { status: 500 });
    conversationId = conversation.id;
    conversationTitleText = conversation.title;
    conversationCreatedAt = conversation.created_at;
    conversationUpdatedAt = conversation.updated_at;
  }

  const { data: duplicate, error: duplicateError } = await context.chatClient
    .from("chat_messages")
    .select("id")
    .eq("conversation_id", conversationId)
    .eq("client_message_id", body.clientMessageId)
    .maybeSingle();
  if (duplicateError) return NextResponse.json({ error: duplicateError.message }, { status: 500 });
  if (duplicate) return NextResponse.json({ error: "ส่งข้อความนี้แล้ว" }, { status: 409 });

  const { error: insertUserError } = await context.chatClient.from("chat_messages").insert({
    conversation_id: conversationId,
    role: "user",
    content: message,
    client_message_id: body.clientMessageId,
  });
  if (insertUserError) {
    if (insertUserError.code === "23505") return NextResponse.json({ error: "ส่งข้อความนี้แล้ว" }, { status: 409 });
    return NextResponse.json({ error: insertUserError.message }, { status: 500 });
  }

  const [{ data: history, error: historyError }, { data: feedEvents, error: feedError }] = await Promise.all([
    context.chatClient
      .from("chat_messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true }),
    (await createClient())
      .from("feed_events")
      .select("meal_slot, target_g, actual_eaten_g, ts")
      .eq("pet_id", context.pet.id)
      .gte("ts", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order("ts", { ascending: true }),
  ]);
  if (historyError) return NextResponse.json({ error: historyError.message }, { status: 500 });
  if (feedError) return NextResponse.json({ error: feedError.message }, { status: 500 });

  const feedHistorySummary = feedEvents?.length
    ? feedEvents.map((event) => `- ${event.meal_slot} @ ${event.ts}: เป้าหมาย ${event.target_g}g, กินจริง ${event.actual_eaten_g}g`).join("\n")
    : "ไม่มีข้อมูลการให้อาหารใน 24 ชั่วโมงที่ผ่านมา";
  const ai = new GoogleGenAI({ apiKey });
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      controller.enqueue(eventLine({
        type: "conversation",
        conversation: { id: conversationId, title: conversationTitleText, created_at: conversationCreatedAt, updated_at: conversationUpdatedAt },
      }));
      try {
        const geminiStream = await ai.models.generateContentStream({
          model: "gemini-2.5-flash",
          config: { maxOutputTokens: 1024, systemInstruction: buildVetSystemPrompt(context.pet, feedHistorySummary) },
          contents: (history ?? []).map((turn) => ({
            role: (turn.role as VetChatRole) === "assistant" ? "model" : "user",
            parts: [{ text: turn.content }],
          })),
        });
        let responseText = "";
        for await (const chunk of geminiStream) {
          if (!chunk.text) continue;
          responseText += chunk.text;
          controller.enqueue(eventLine({ type: "chunk", text: chunk.text }));
        }
        if (!responseText.trim()) throw new Error("empty Gemini response");
        const { error: insertAssistantError } = await context.chatClient.from("chat_messages").insert({
          conversation_id: conversationId,
          role: "assistant",
          content: responseText.trim(),
        });
        if (insertAssistantError) throw insertAssistantError;
        controller.enqueue(eventLine({ type: "complete" }));
      } catch (error) {
        controller.enqueue(eventLine({ type: "error", message: userFacingError(error) }));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
