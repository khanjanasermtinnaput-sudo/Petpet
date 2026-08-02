"use client";

import { useState } from "react";
import { NeuIconButton } from "@/components/neu/NeuIconButton";

export function ManualFeedButton({
  onFeed,
  disabled = false,
}: {
  onFeed: () => Promise<void>;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [pressed, setPressed] = useState(false);

  async function handleClick() {
    if (loading || disabled) return;
    setPressed(true);
    setLoading(true);
    try {
      await onFeed();
    } finally {
      setLoading(false);
      setPressed(false);
    }
  }

  return (
    <div className="fixed bottom-20 left-1/2 z-30 -translate-x-1/2 md:bottom-8 md:left-auto md:right-8 md:translate-x-0">
      <NeuIconButton
        aria-label="เทอาหารตอนนี้"
        pressed={pressed}
        disabled={loading || disabled}
        onClick={handleClick}
        className="h-16 w-16 text-2xl text-neu-accent"
      >
        {loading ? (
          <span
            className="h-6 w-6 animate-spin rounded-full border-2 border-neu-accent border-t-transparent"
            aria-hidden
          />
        ) : (
          "🍽️"
        )}
      </NeuIconButton>
    </div>
  );
}
