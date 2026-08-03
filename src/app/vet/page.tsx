"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { NavRail } from "@/components/dashboard/NavRail";
import { NeuThemeToggle } from "@/components/neu/NeuThemeToggle";
import { ChatInput } from "@/components/vet/ChatInput";
import { ChatMessage, type ChatMessageData } from "@/components/vet/ChatMessage";

interface PetSummary {
  name: string;
  species: string;
  breed: string;
}

interface ChatResponse {
  pet?: PetSummary | null;
  messages?: Array<ChatMessageData & { id: string; created_at: string }>;
  error?: string;
}

export default function VetChatPage() {
  const [messages, setMessages] = useState<ChatMessageData[]>([]);
  const [pet, setPet] = useState<PetSummary | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/chat", { cache: "no-store" })
      .then((response) => response.json() as Promise<ChatResponse>)
      .then((body) => {
        if (!active) return;
        setPet(body.pet ?? null);
        setMessages(body.messages?.map(({ role, content }) => ({ role, content })) ?? []);
      })
      .finally(() => {
        if (active) setLoadingHistory(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = useCallback(async (userText: string) => {
    const nextMessages = [...messages, { role: "user" as const, content: userText }];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body.error ?? "ระบบ AI ขัดข้อง");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setMessages((previous) => [...previous.slice(0, -1), { role: "assistant", content: accumulated }]);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "เชื่อมต่อ AI ไม่สำเร็จ";
      setMessages((previous) => [...previous.slice(0, -1), { role: "assistant", content: message }]);
    } finally {
      setSending(false);
    }
  }, [messages]);

  return (
    <div className="flex min-h-screen flex-col bg-neu-bg pb-28 md:pb-4 md:pl-24">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-neu-bg/90 px-4 py-4 backdrop-blur-sm sm:px-8">
        <div>
          <p className="text-xs font-semibold text-neu-accent">CARE SPACE</p>
          <h1 className="text-lg font-bold text-neu-ink">AI สัตวแพทย์</h1>
        </div>
        <NeuThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-4 pb-4 sm:px-8">
        {pet && (
          <div className="neu-raised-sm flex items-center gap-3 p-3 text-sm">
            <span className="text-2xl" aria-hidden>{pet.species === "Cat" ? "🐱" : "🐶"}</span>
            <div>
              <p className="font-bold text-neu-ink">คุยเรื่อง {pet.name}</p>
              <p className="text-xs text-neu-ink-muted">{pet.breed || "ไม่ระบุสายพันธุ์"} · ประวัติแชตถูกบันทึกแยกสำหรับน้องตัวนี้</p>
            </div>
          </div>
        )}
        {loadingHistory && <p className="mt-8 text-center text-sm text-neu-ink-muted">กำลังโหลดประวัติการสนทนา...</p>}
        {!loadingHistory && messages.length === 0 && (
          <p className="mt-8 text-center text-sm text-neu-ink-muted">ถามเรื่องสุขภาพ อาหาร หรือพฤติกรรมของน้องได้เลย</p>
        )}
        {messages.map((message, index) => <ChatMessage key={`${message.role}-${index}`} {...message} />)}
        <div ref={scrollRef} />
      </main>

      <div className="sticky bottom-16 mx-auto w-full max-w-2xl px-4 pb-4 sm:px-8 md:bottom-0">
        <ChatInput onSend={handleSend} disabled={sending || loadingHistory || !pet} />
      </div>
      <NavRail />
    </div>
  );
}
