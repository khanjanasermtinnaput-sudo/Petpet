"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NavRail } from "@/components/dashboard/NavRail";
import { NeuThemeToggle } from "@/components/neu/NeuThemeToggle";
import { ChatInput } from "@/components/vet/ChatInput";
import { ChatMessage, type ChatMessageData } from "@/components/vet/ChatMessage";

export default function VetChatPage() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(
    async (userText: string) => {
      const nextMessages: ChatMessageData[] = [
        ...messages,
        { role: "user", content: userText },
      ];
      setMessages([...nextMessages, { role: "assistant", content: "" }]);
      setSending(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: nextMessages }),
        });

        if (!res.ok || !res.body) {
          const errBody = await res.json().catch(() => ({}));
          const errorText: string =
            errBody.error ?? "ขอโทษค่ะ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง";
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: errorText };
            return updated;
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          setMessages((prev) => {
            const updated = [...prev];
            updated[updated.length - 1] = { role: "assistant", content: accumulated };
            return updated;
          });
        }
      } catch {
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
          };
          return updated;
        });
      } finally {
        setSending(false);
      }
    },
    [messages],
  );

  return (
    <div className="flex min-h-screen flex-col pb-28 md:pb-4 md:pl-24">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-neu-bg/90 px-4 py-4 backdrop-blur-sm sm:px-8">
        <h1 className="text-lg font-bold text-neu-ink">AI สัตวแพทย์</h1>
        <NeuThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 pb-4 sm:px-8">
        {messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-neu-ink-muted">
            สอบถามเกี่ยวกับสุขภาพและพฤติกรรมการกินของน้องได้เลย
          </p>
        )}
        {messages.map((m, i) => (
          <ChatMessage key={i} role={m.role} content={m.content} />
        ))}
        <div ref={scrollRef} />
      </main>

      <div className="sticky bottom-16 mx-auto w-full max-w-2xl px-4 pb-4 sm:px-8 md:bottom-0">
        <ChatInput onSend={handleSend} disabled={sending} />
      </div>

      <NavRail />
    </div>
  );
}
