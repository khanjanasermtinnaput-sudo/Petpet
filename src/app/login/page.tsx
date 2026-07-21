"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { NeuButton } from "@/components/neu/NeuButton";
import { NeuCard } from "@/components/neu/NeuCard";
import { NeuInput } from "@/components/neu/NeuInput";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: authError } =
      mode === "signin"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });

    setLoading(false);

    if (authError) {
      setError(authError.message);
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <NeuCard className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold text-neu-ink">
          Petpet 🐾
        </h1>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <NeuInput
            label="อีเมล"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <NeuInput
            label="รหัสผ่าน"
            type="password"
            autoComplete={mode === "signin" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm font-semibold text-neu-warning">
              {error}
            </p>
          )}
          <NeuButton type="submit" variant="accent" disabled={loading} className="mt-2">
            {loading
              ? "กำลังดำเนินการ..."
              : mode === "signin"
                ? "เข้าสู่ระบบ"
                : "สร้างบัญชี"}
          </NeuButton>
        </form>
        <button
          type="button"
          className="neu-focusable mt-4 w-full rounded-lg py-2 text-sm font-semibold text-neu-ink-muted"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin"
            ? "ยังไม่มีบัญชี? สร้างบัญชีใหม่"
            : "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ"}
        </button>
      </NeuCard>
    </main>
  );
}
