import { NextResponse } from "next/server";
import { getChatContext } from "@/lib/chat-context";
import { isUuid } from "@/lib/vet-chat";
import { VET_CHAT_IMAGE_BUCKET } from "@/lib/vet-chat-image";

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
    .select("id, role, content, image_path, image_mime_type, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
  if (messagesError) return NextResponse.json({ error: messagesError.message }, { status: 500 });

  const imagePaths = (messages ?? []).flatMap((message) => message.image_path ? [message.image_path] : []);
  const imageUrlByPath = new Map<string, string>();
  if (imagePaths.length > 0) {
    const { data: signedImages } = await context.chatClient.storage
      .from(VET_CHAT_IMAGE_BUCKET)
      .createSignedUrls(imagePaths, 60 * 60);
    for (const image of signedImages ?? []) {
      if (image.path && image.signedUrl) imageUrlByPath.set(image.path, image.signedUrl);
    }
  }

  const messagesWithImages = (messages ?? []).map(({ image_path: imagePath, image_mime_type: imageMimeType, ...message }) => ({
    ...message,
    imagePath,
    imageMimeType,
    imageUrl: imagePath ? imageUrlByPath.get(imagePath) ?? null : null,
  }));

  return NextResponse.json({ conversation, messages: messagesWithImages }, { headers: { "Cache-Control": "no-store" } });
}
