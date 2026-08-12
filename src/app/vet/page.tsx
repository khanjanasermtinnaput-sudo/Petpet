"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NavRail } from "@/components/dashboard/NavRail";
import { NeuThemeToggle } from "@/components/neu/NeuThemeToggle";
import { ChatInput, type ChatInputImage } from "@/components/vet/ChatInput";
import { ChatMessage, type ChatMessageData } from "@/components/vet/ChatMessage";
import { ChatHistory, type ConversationSummary } from "@/components/vet/ChatHistory";

type ConversationResponse = { conversations?: ConversationSummary[]; error?: string };
type MessagesResponse = { messages?: Array<{ id: string; role: "user" | "assistant"; content: string; imageUrl?: string | null }>; error?: string };
type StreamEvent =
  | { type: "conversation"; conversation: ConversationSummary }
  | { type: "status"; message: string }
  | { type: "chunk"; text: string }
  | { type: "complete" }
  | { type: "error"; message: string };

function temporaryAssistant(content = ""): ChatMessageData {
  return { role: "assistant", content };
}

export default function VetChatPage() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const sendingRef = useRef(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [messageError, setMessageError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const localPreviewUrls = useRef(new Set<string>());

  useEffect(() => { scrollRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);
  useEffect(() => () => {
    for (const url of localPreviewUrls.current) URL.revokeObjectURL(url);
  }, []);

  const clearLocalPreviews = useCallback(() => {
    for (const url of localPreviewUrls.current) URL.revokeObjectURL(url);
    localPreviewUrls.current.clear();
  }, []);

  const loadConversations = useCallback(async () => {
    setLoadingHistory(true);
    setHistoryError(null);
    try {
      const response = await fetch("/api/chat/conversations", { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as ConversationResponse;
      if (!response.ok) throw new Error(body.error ?? "โหลดประวัติแชทไม่สำเร็จ");
      setConversations(body.conversations ?? []);
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "โหลดประวัติแชทไม่สำเร็จ");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    async function initialize() {
      try {
        const session = await fetch("/api/chat/session", { method: "POST" });
        if (!session.ok) {
          const body = await session.json().catch(() => ({})) as { error?: string };
          throw new Error(body.error ?? "เริ่ม session ของ VET AI ไม่สำเร็จ");
        }
        await loadConversations();
      } catch (error) {
        setHistoryError(error instanceof Error ? error.message : "เริ่ม VET AI ไม่สำเร็จ");
        setLoadingHistory(false);
      }
    }
    void initialize();
  }, [loadConversations]);

  const selectConversation = useCallback(async (conversationId: string) => {
    if (sendingRef.current) return;
    clearLocalPreviews();
    setSelectedId(conversationId);
    setMessages([]);
    setMessageError(null);
    setHistoryOpen(false);
    setLoadingMessages(true);
    try {
      const response = await fetch(`/api/chat/conversations/${conversationId}`, { cache: "no-store" });
      const body = await response.json().catch(() => ({})) as MessagesResponse;
      if (!response.ok) throw new Error(body.error ?? "โหลดข้อความไม่สำเร็จ");
      setMessages((body.messages ?? []).map(({ role, content, imageUrl }) => ({ role, content, imageUrl })));
    } catch (error) {
      setMessageError(error instanceof Error ? error.message : "โหลดข้อความไม่สำเร็จ");
    } finally {
      setLoadingMessages(false);
    }
  }, [clearLocalPreviews]);

  const startNewChat = useCallback(() => {
    if (sendingRef.current) return;
    clearLocalPreviews();
    setSelectedId(null);
    setMessages([]);
    setMessageError(null);
    setHistoryOpen(false);
  }, [clearLocalPreviews]);

  const handleSend = useCallback(async (userText: string, image?: ChatInputImage): Promise<boolean> => {
    if (sendingRef.current) return false;
    sendingRef.current = true;
    setSending(true);
    setMessageError(null);
    if (image) localPreviewUrls.current.add(image.previewUrl);
    setMessages((previous) => [
      ...previous,
      { role: "user", content: userText, imageUrl: image?.previewUrl },
      temporaryAssistant(image ? "กำลังดูภาพ..." : ""),
    ]);

    const requestController = new AbortController();
    let inactivityTimeout: number | undefined;
    const resetInactivityTimeout = () => {
      if (inactivityTimeout !== undefined) window.clearTimeout(inactivityTimeout);
      inactivityTimeout = window.setTimeout(() => requestController.abort(), 60_000);
    };

    try {
      resetInactivityTimeout();
      const clientMessageId = crypto.randomUUID();
      const requestBody = image ? new FormData() : JSON.stringify({
        conversationId: selectedId ?? undefined,
        message: userText,
        clientMessageId,
      });
      if (image && requestBody instanceof FormData) {
        if (selectedId) requestBody.set("conversationId", selectedId);
        requestBody.set("message", userText);
        requestBody.set("clientMessageId", clientMessageId);
        requestBody.set("image", image.file);
      }
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: image ? undefined : { "Content-Type": "application/json" },
        body: requestBody,
        signal: requestController.signal,
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "VET AI ตอบไม่สำเร็จ");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let completed = false;

      const processEvent = (event: StreamEvent) => {
        if (event.type === "conversation") {
          setSelectedId(event.conversation.id);
          setConversations((current) => [event.conversation, ...current.filter((item) => item.id !== event.conversation.id)]);
        }
        if (event.type === "status" && !assistantText) {
          setMessages((current) => [...current.slice(0, -1), temporaryAssistant(event.message)]);
        }
        if (event.type === "chunk") {
          assistantText += event.text;
          setMessages((current) => [...current.slice(0, -1), temporaryAssistant(assistantText)]);
        }
        if (event.type === "complete") completed = true;
        if (event.type === "error") {
          setMessageError(event.message);
          const displayed = assistantText ? `${assistantText}\n\n${event.message}` : event.message;
          setMessages((current) => [...current.slice(0, -1), temporaryAssistant(displayed)]);
        }
      };

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        resetInactivityTimeout();
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          processEvent(JSON.parse(line) as StreamEvent);
        }
      }
      if (buffer) processEvent(JSON.parse(buffer) as StreamEvent);
      if (!completed) throw new Error("VET AI ตอบไม่สำเร็จ");
      await loadConversations();
      return true;
    } catch (error) {
      const message = error instanceof Error && error.name === "AbortError"
        ? "การส่งรูปหรือข้อความใช้เวลานานเกินไป กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"
        : error instanceof Error ? error.message : "VET AI ตอบไม่สำเร็จ";
      setMessageError(message);
      setMessages((current) => [...current.slice(0, -1), temporaryAssistant(message)]);
      return false;
    } finally {
      if (inactivityTimeout !== undefined) window.clearTimeout(inactivityTimeout);
      sendingRef.current = false;
      setSending(false);
    }
  }, [loadConversations, selectedId]);

  const historyProps = { conversations, selectedId, loading: loadingHistory, error: historyError, disabled: sending || loadingMessages, onNewChat: startNewChat, onSelect: (id: string) => void selectConversation(id) };

  return (
    <div className="min-h-screen pb-28 md:pb-0 md:pl-24">
      <div className="mx-auto flex min-h-screen max-w-6xl">
        <aside className="hidden w-72 shrink-0 border-r border-neu-ink-muted/15 px-4 py-6 md:block">
          <ChatHistory {...historyProps} />
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex items-center justify-between bg-neu-bg/90 px-4 py-4 backdrop-blur-sm sm:px-8">
            <div className="flex items-center gap-2">
              <button type="button" className="neu-focusable neu-raised-sm px-3 py-2 text-sm font-semibold text-neu-accent md:hidden" aria-expanded={historyOpen} aria-controls="vet-history-drawer" onClick={() => setHistoryOpen(true)}>ประวัติ</button>
              <h1 className="text-lg font-bold text-neu-ink">VET AI</h1>
            </div>
            <NeuThemeToggle />
          </header>

          <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 py-4 sm:px-8">
            {loadingMessages ? <p className="mt-8 text-center text-sm text-neu-ink-muted">กำลังโหลดข้อความ...</p> : null}
            {messages.length === 0 && !messageError && !loadingMessages ? <p className="mt-8 text-center text-sm text-neu-ink-muted">สอบถามเกี่ยวกับสุขภาพและพฤติกรรมการกินของน้องได้เลย</p> : null}
            {messages.map((message, index) => <ChatMessage key={`${message.role}-${index}`} {...message} />)}
            {messageError ? <p role="alert" className="text-center text-sm font-semibold text-neu-warning">{messageError}</p> : null}
            <div ref={scrollRef} />
          </main>

          <div className="sticky bottom-16 mx-auto w-full max-w-2xl px-4 pb-4 sm:px-8 md:bottom-0">
            <ChatInput onSend={handleSend} disabled={sending || loadingHistory || loadingMessages} />
          </div>
        </div>
      </div>

      {historyOpen ? (
        <div className="fixed inset-0 z-50 md:hidden" role="dialog" aria-modal="true" aria-label="ประวัติแชท" onKeyDown={(event) => { if (event.key === "Escape") setHistoryOpen(false); }}>
          <button type="button" className="absolute inset-0 bg-neu-ink/25" aria-label="ปิดประวัติแชท" onClick={() => setHistoryOpen(false)} />
          <aside id="vet-history-drawer" className="relative h-full w-[min(20rem,85vw)] bg-neu-bg px-4 py-6 shadow-2xl">
            <ChatHistory {...historyProps} />
          </aside>
        </div>
      ) : null}
      <NavRail />
    </div>
  );
}
