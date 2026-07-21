"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { NeuButton } from "@/components/neu/NeuButton";
import { NeuCard } from "@/components/neu/NeuCard";
import { NeuInput } from "@/components/neu/NeuInput";
import { NeuSelect } from "@/components/neu/NeuSelect";

export default function OnboardingPage() {
  const router = useRouter();
  const [deviceId, setDeviceId] = useState("");
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("Dog");
  const [ageYears, setAgeYears] = useState(0);
  const [ageMonths, setAgeMonths] = useState(0);
  const [weightKg, setWeightKg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const res = await fetch("/api/pets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId,
        name,
        species,
        ageYears,
        ageMonths,
        weightKg: Number(weightKg),
      }),
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
      <NeuCard className="w-full max-w-md">
        <h1 className="mb-1 text-center text-2xl font-bold text-neu-ink">
          ตั้งค่าเครื่องให้อาหาร
        </h1>
        <p className="mb-6 text-center text-sm text-neu-ink-muted">
          กรอกข้อมูลอุปกรณ์และน้องสัตว์เลี้ยงของคุณ
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <NeuInput
            label="รหัสอุปกรณ์ (Device Serial)"
            required
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            placeholder="เช่น PETFEEDER-0001"
          />
          <NeuInput
            label="ชื่อสัตว์เลี้ยง"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <NeuSelect
            label="ชนิด/สายพันธุ์"
            value={species}
            onChange={(e) => setSpecies(e.target.value)}
          >
            <option value="Dog">สุนัข</option>
            <option value="Cat">แมว</option>
            <option value="Other">อื่นๆ</option>
          </NeuSelect>
          <div className="grid grid-cols-2 gap-4">
            <NeuInput
              label="อายุ (ปี)"
              type="number"
              min={0}
              value={ageYears}
              onChange={(e) => setAgeYears(Number(e.target.value))}
            />
            <NeuInput
              label="อายุ (เดือน)"
              type="number"
              min={0}
              max={11}
              value={ageMonths}
              onChange={(e) => setAgeMonths(Number(e.target.value))}
            />
          </div>
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
