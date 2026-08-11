import { NextResponse } from "next/server";
import { getChatContext } from "@/lib/chat-context";

export async function GET() {
  const context = await getChatContext();
  if (!context) return NextResponse.json({ error: "ต้องเริ่ม session ของ VET AI ก่อน" }, { status: 401 });

  const { data, error } = await context.chatClient
    .from("chat_conversations")
    .select("id, pet_id, title, created_at, updated_at")
    .eq("pet_id", context.pet.id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ conversations: data ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
