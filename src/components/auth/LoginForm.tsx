"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { NeuButton } from "@/components/neu/NeuButton";
import { NeuCard } from "@/components/neu/NeuCard";
import { NeuInput } from "@/components/neu/NeuInput";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError("อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
      return;
    }

    const next = new URL(window.location.href).searchParams.get("next");
    const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/settings";
    router.replace(destination);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <NeuCard className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mb-3 text-4xl" aria-hidden>
            🐾
          </div>
          <h1 className="text-2xl font-bold text-neu-ink">เข้าสู่ระบบ Petpet</h1>
          <p className="mt-2 text-sm text-neu-ink-muted">
            เข้าสู่ระบบเพื่อแก้ไขข้อมูลสัตว์เลี้ยง
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <NeuInput
            label="อีเมล"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <NeuInput
            label="รหัสผ่าน"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm font-semibold text-neu-warning">
              {error}
            </p>
          )}
          <NeuButton type="submit" variant="accent" disabled={loading} className="mt-2">
            {loading ? "กำลังเข้าสู่ระบบ..." : "เข้าสู่ระบบ"}
          </NeuButton>
        </form>
      </NeuCard>
    </main>
  );
}
