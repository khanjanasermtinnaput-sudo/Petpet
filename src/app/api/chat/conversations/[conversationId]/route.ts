import { NextResponse } from "next/server";
import { getChatContext } from "@/lib/chat-context";
import { isUuid } from "@/lib/vet-chat";

export async function GET(_request: Request, { params }: { params: Promise<{ conversationId: string }> }) {
  const { conversationId } = await params;
  if (!isUuid(conversationId)) return NextResponse.json({ error: "conversationId must be a UUID" }, { status: 400 });

  const context = await getChatContext();
  if (!context) return NextResponse.json({ error: "ต้องเริ่ม session ของ VET AI ก่อน" }, { status: 401 });

  const { data: conversation, error: conversationError } = await context.chatClient
    .from("chat_conversations")
    .select("id, pet_id, title, created_at, updated_at")
    .eq("id", conversationId)
    .maybeSingle();
  if (conversationError) return NextResponse.json({ error: conversationError.message }, { status: 500 });
  if (!conversation) return NextResponse.json({ error: "ไม่พบแชท" }, { status: 404 });
  if (conversation.pet_id !== context.pet.id) {
    return NextResponse.json({ error: "แชทนี้ไม่ได้เป็นของสัตว์เลี้ยงที่เลือกอยู่" }, { status: 403 });
  }

  const { data: messages, error: messagesError } = await context.chatClient
    .from("chat_messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (messagesError) return NextResponse.json({ error: messagesError.message }, { status: 500 });

  return NextResponse.json({ conversation, messages: messages ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
