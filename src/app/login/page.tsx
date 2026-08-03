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
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    const supabase = createClient();
    const result = mode === "signin"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password });

    setLoading(false);
    if (result.error) {
      setError(result.error.message);
      return;
    }

    if (mode === "signup" && !result.data.session) {
      setMessage("สร้างบัญชีแล้ว กรุณาตรวจสอบอีเมลเพื่อยืนยันก่อนเข้าสู่ระบบ");
      return;
    }

    router.replace("/");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neu-bg p-4">
      <NeuCard className="w-full max-w-sm">
        <div className="mb-7 text-center">
          <p className="mb-2 text-sm font-semibold text-neu-accent">Petpet companion</p>
          <h1 className="text-3xl font-bold text-neu-ink">ยินดีต้อนรับ 🐾</h1>
          <p className="mt-2 text-sm text-neu-ink-muted">เข้าสู่ระบบเพื่อดูแลน้องของคุณ</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <NeuInput label="อีเมล" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
          <NeuInput label="รหัสผ่าน" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} minLength={6} required value={password} onChange={(event) => setPassword(event.target.value)} />
          {error && <p role="alert" className="text-sm font-semibold text-neu-warning">{error}</p>}
          {message && <p role="status" className="text-sm font-semibold text-neu-accent">{message}</p>}
          <NeuButton type="submit" variant="accent" disabled={loading} className="mt-2 w-full">
            {loading ? "กำลังดำเนินการ..." : mode === "signin" ? "เข้าสู่ระบบ" : "สร้างบัญชี"}
          </NeuButton>
        </form>
        <button type="button" className="neu-focusable mt-4 w-full rounded-lg py-2 text-sm font-semibold text-neu-ink-muted" onClick={() => setMode(mode === "signin" ? "signup" : "signin")}>
          {mode === "signin" ? "ยังไม่มีบัญชี? สร้างบัญชีใหม่" : "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ"}
        </button>
      </NeuCard>
    </main>
  );
}
