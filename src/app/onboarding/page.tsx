"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { NeuButton } from "@/components/neu/NeuButton";
import { NeuCard } from "@/components/neu/NeuCard";
import { NeuInput } from "@/components/neu/NeuInput";
import { NeuSelect } from "@/components/neu/NeuSelect";
import { BreedCombobox } from "@/components/pets/BreedCombobox";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("Dog");
  const [breed, setBreed] = useState<string | null>(null);
  const [birthDate, setBirthDate] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (!breed) {
      setError("กรุณาเลือกสายพันธุ์");
      return;
    }
    setLoading(true);

    const res = await fetch("/api/pets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, species, breed, birthDate, weightKg: Number(weightKg) }),
    });

    setLoading(false);

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "เกิดข้อผิดพลาด กรุณาลองใหม่");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <NeuCard className="w-full max-w-sm">
        <h1 className="mb-1 text-center text-2xl font-bold text-neu-ink">Petpet 🐾</h1>
        <p className="mb-6 text-center text-sm text-neu-ink-muted">
          กรอกข้อมูลน้องสัตว์เลี้ยงของคุณ
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <NeuInput
            label="ชื่อสัตว์เลี้ยง"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <NeuSelect
            label="ชนิดสัตว์เลี้ยง"
            value={species}
            onChange={(e) => { setSpecies(e.target.value); setBreed(null); }}
          >
            <option value="Dog">หมา</option>
            <option value="Cat">แมว</option>
          </NeuSelect>
          <BreedCombobox
            label="สายพันธุ์"
            species={species === "Cat" ? "Cat" : "Dog"}
            value={breed}
            onChange={setBreed}
            required
          />
          <NeuInput
            label="วันเดือนปีเกิด"
            type="date"
            required
            max={new Date().toISOString().slice(0, 10)}
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
          <NeuInput
            label="น้ำหนัก (กก.)"
            type="number"
            min={0}
            step={0.1}
            required
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm font-semibold text-neu-warning">
              {error}
            </p>
          )}
          <NeuButton type="submit" variant="accent" disabled={loading} className="mt-2">
            {loading ? "กำลังบันทึก..." : "เริ่มต้นใช้งาน"}
          </NeuButton>
        </form>
      </NeuCard>
    </main>
  );
}
