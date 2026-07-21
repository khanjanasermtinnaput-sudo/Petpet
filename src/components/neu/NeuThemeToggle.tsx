"use client";

import { useState } from "react";

const STORAGE_KEY = "petpet-theme";

function readInitialIsDark(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.getAttribute("data-theme") === "dark";
}

export function NeuThemeToggle() {
  const [isDark, setIsDark] = useState(readInitialIsDark);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    const theme = next ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage unavailable (private browsing, etc.) — theme just won't persist.
    }
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      aria-label="สลับธีมสว่าง/มืด"
      onClick={toggle}
      suppressHydrationWarning
      className="neu-focusable relative h-[30px] w-14 shrink-0 rounded-full border-none bg-transparent p-0"
    >
      <span className="neu-inset absolute inset-0 rounded-full" aria-hidden />
      <svg
        className={`absolute left-[7px] top-1/2 -translate-y-1/2 text-neu-ink-muted transition-opacity ${isDark ? "opacity-30" : "opacity-100"}`}
        suppressHydrationWarning
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        aria-hidden
      >
        <circle cx="12" cy="12" r="4.5" />
        <path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
      </svg>
      <svg
        className={`absolute right-[7px] top-1/2 -translate-y-1/2 text-neu-ink-muted transition-opacity ${isDark ? "opacity-100" : "opacity-30"}`}
        suppressHydrationWarning
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden
      >
        <path d="M20.5 14.7A8.5 8.5 0 1 1 9.3 3.5a7 7 0 0 0 11.2 11.2Z" />
      </svg>
      <span
        className="neu-raised-sm neu-press-active absolute top-[3px] left-[3px] h-6 w-6 rounded-full transition-transform duration-200"
        style={{ transform: isDark ? "translateX(26px)" : "translateX(0)" }}
        suppressHydrationWarning
        aria-hidden
      />
    </button>
  );
}
