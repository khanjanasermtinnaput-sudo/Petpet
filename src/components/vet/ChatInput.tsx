"use client";

import { useState, type FormEvent } from "react";
import { NeuIconButton } from "@/components/neu/NeuIconButton";
import { NeuIcon } from "@/components/neu/NeuIcon";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-3">
      <label htmlFor="vet-chat-input" className="sr-only">
        พิมพ์ข้อความถึง VET AI
      </label>
      <input
        id="vet-chat-input"
        className="neu-inset neu-focusable flex-1 border-none px-4 py-3 text-neu-ink outline-none placeholder:text-neu-ink-muted/60"
        placeholder="พิมพ์คำถามของคุณ..."
        value={value}
        disabled={disabled}
        onChange={(e) => setValue(e.target.value)}
      />
      <NeuIconButton
        type="submit"
        aria-label="ส่งข้อความ"
        disabled={disabled || !value.trim()}
        className="h-12 w-12 shrink-0 text-neu-accent"
      >
        <NeuIcon name="send" className="h-5 w-5" />
      </NeuIconButton>
    </form>
  );
}
