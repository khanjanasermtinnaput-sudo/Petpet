"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { NeuButton } from "@/components/neu/NeuButton";
import { NeuCard } from "@/components/neu/NeuCard";
import { NeuInput } from "@/components/neu/NeuInput";
import { NeuSelect } from "@/components/neu/NeuSelect";
import { PetBreedSelect } from "@/components/onboarding/PetBreedSelect";
import type { PetSpecies } from "@/lib/pet-breeds";

export default function OnboardingPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [species, setSpecies] = useState<PetSpecies>("Dog");
  const [breed, setBreed] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          species,
          breed,
          birthDate,
          weightKg: Number(weightKg),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setError(body.error ?? "บันทึกข้อมูลไม่สำเร็จ กรุณาลองใหม่");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("เชื่อมต่อระบบไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-neu-bg p-4">
      <NeuCard className="w-full max-w-lg">
        <div className="mb-7 text-center">
          <p className="mb-2 text-sm font-semibold text-neu-accent">เริ่มต้นดูแลสมาชิกใหม่</p>
          <h1 className="text-3xl font-bold text-neu-ink">ข้อมูลสัตว์เลี้ยง 🐾</h1>
          <p className="mt-2 text-sm text-neu-ink-muted">
            ข้อมูลนี้ช่วยให้ AI สัตวแพทย์ให้คำแนะนำได้เหมาะกับแต่ละตัว
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <NeuInput
            label="ชื่อสัตว์เลี้ยง"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="เช่น โมจิ"
          />
          <NeuSelect
            label="ชนิดสัตว์เลี้ยง"
            value={species}
            onChange={(event) => {
              setSpecies(event.target.value as PetSpecies);
              setBreed("");
            }}
          >
            <option value="Dog">สุนัข</option>
            <option value="Cat">แมว</option>
          </NeuSelect>
          <PetBreedSelect species={species} value={breed} onChange={setBreed} />
          <NeuInput
            label="วันเดือนปีเกิด"
            type="date"
            required
            max={new Date().toISOString().slice(0, 10)}
            value={birthDate}
            onChange={(event) => setBirthDate(event.target.value)}
          />
          <NeuInput
            label="น้ำหนัก (กก.)"
            type="number"
            min={0.1}
            step={0.1}
            required
            value={weightKg}
            onChange={(event) => setWeightKg(event.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm font-semibold text-neu-warning">
              {error}
            </p>
          )}
          <NeuButton type="submit" variant="accent" disabled={loading || !breed} className="mt-2 w-full">
            {loading ? "กำลังบันทึกข้อมูล..." : "เริ่มใช้งาน Petpet"}
          </NeuButton>
        </form>
      </NeuCard>
    </main>
  );
}
