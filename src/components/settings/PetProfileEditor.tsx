"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { NeuButton } from "@/components/neu/NeuButton";
import { NeuCard } from "@/components/neu/NeuCard";
import { NeuInput } from "@/components/neu/NeuInput";
import { NeuSelect } from "@/components/neu/NeuSelect";
import type { Pet } from "@/lib/types";

export function PetProfileEditor({ pet, authenticated }: { pet: Pet; authenticated: boolean }) {
  const router = useRouter();
  const [name, setName] = useState(pet.name);
  const [species, setSpecies] = useState(pet.species || "Dog");
  const [birthDate, setBirthDate] = useState(pet.birth_date ?? "");
  const [weightKg, setWeightKg] = useState(String(pet.weight_kg));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!authenticated) {
    return (
      <NeuCard>
        <h2 className="text-lg font-bold text-neu-ink">ข้อมูลสัตว์เลี้ยง</h2>
        <p className="mt-2 text-sm text-neu-ink-muted">
          เข้าสู่ระบบก่อน หากต้องการเปลี่ยนชื่อหรือข้อมูลของน้อง
        </p>
        <Link
          href="/login?next=/settings"
          className="neu-raised-sm neu-focusable neu-press-active mt-5 inline-flex px-5 py-3 font-semibold text-neu-accent"
        >
          เข้าสู่ระบบเพื่อแก้ไขข้อมูล
        </Link>
      </NeuCard>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    const response = await fetch("/api/pets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        species,
        birthDate,
        weightKg: Number(weightKg),
      }),
    });
    const body = await response.json().catch(() => ({}));

    setSaving(false);
    if (!response.ok) {
      setError(body.error ?? "บันทึกข้อมูลไม่สำเร็จ");
      return;
    }

    setMessage("บันทึกข้อมูลเรียบร้อยแล้ว");
    router.refresh();
  }

  return (
    <NeuCard>
      <h2 className="text-lg font-bold text-neu-ink">ข้อมูลสัตว์เลี้ยง</h2>
      <p className="mt-2 text-sm text-neu-ink-muted">
        เปลี่ยนข้อมูลที่ใช้ประกอบการวางแผนการให้อาหารได้ที่นี่
      </p>
      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <NeuInput
          label="ชื่อสัตว์เลี้ยง"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <NeuSelect label="ชนิดสัตว์เลี้ยง" value={species} onChange={(event) => setSpecies(event.target.value)}>
          <option value="Dog">สุนัข</option>
          <option value="Cat">แมว</option>
        </NeuSelect>
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
          min={0}
          step={0.1}
          required
          value={weightKg}
          onChange={(event) => setWeightKg(event.target.value)}
        />
        {error && <p role="alert" className="text-sm font-semibold text-neu-warning">{error}</p>}
        {message && <p role="status" className="text-sm font-semibold text-neu-success">{message}</p>}
        <NeuButton type="submit" variant="accent" disabled={saving}>
          {saving ? "กำลังบันทึก..." : "บันทึกข้อมูล"}
        </NeuButton>
      </form>
    </NeuCard>
  );
}
