"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { NeuButton } from "@/components/neu/NeuButton";
import { NeuCard } from "@/components/neu/NeuCard";
import { NeuInput } from "@/components/neu/NeuInput";
import { NeuSelect } from "@/components/neu/NeuSelect";
import { BreedCombobox } from "@/components/pets/BreedCombobox";
import type { Pet } from "@/lib/types";

export function PetProfileEditor({ pet, pets }: { pet: Pet; pets: Pet[] }) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState(pet.name);
  const [species, setSpecies] = useState(pet.species || "Dog");
  const [breed, setBreed] = useState<string | null>(pet.breed);
  const [birthDate, setBirthDate] = useState(pet.birth_date ?? "");
  const [weightKg, setWeightKg] = useState(String(pet.weight_kg));
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectPet(petId: string) {
    if (petId === pet.id) return;
    setSwitching(true);
    setError(null);
    try {
      const response = await fetch("/api/pets/active", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ petId }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "ไม่สามารถเลือกสัตว์เลี้ยงได้");
        return;
      }
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSwitching(false);
    }
  }

  function startAdding() {
    setAdding(true);
    setName("");
    setSpecies("Dog");
    setBreed(null);
    setBirthDate("");
    setWeightKg("");
    setMessage(null);
    setError(null);
  }

  function cancelAdding() {
    setAdding(false);
    setName(pet.name);
    setSpecies(pet.species || "Dog");
    setBreed(pet.breed);
    setBirthDate(pet.birth_date ?? "");
    setWeightKg(String(pet.weight_kg));
    setError(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/pets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(adding ? {} : { petId: pet.id }),
          name: name.trim(),
          species,
          breed,
          birthDate,
          weightKg: Number(weightKg),
        }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(body.error ?? "บันทึกข้อมูลไม่สำเร็จ");
        return;
      }
      setMessage(adding
        ? "เพิ่มสัตว์เลี้ยงแล้ว"
        : "บันทึกข้อมูลเรียบร้อยแล้ว — กดให้ AI จัดตารางอาหารเพื่อใช้ข้อมูลล่าสุด");
      setAdding(false);
      router.refresh();
    } catch {
      setError("เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  }

  return (
    <NeuCard>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neu-ink">ข้อมูลสัตว์เลี้ยง</h2>
          <p className="mt-1 text-sm text-neu-ink-muted">เลือก แก้ไข หรือเพิ่มข้อมูลสัตว์เลี้ยงได้ที่นี่</p>
        </div>
        {!adding && (
          <NeuButton type="button" variant="accent" onClick={startAdding}>
            เพิ่มสัตว์เลี้ยง
          </NeuButton>
        )}
      </div>

      {!adding && (
        <div className="mt-5">
          <NeuSelect
            label="สัตว์เลี้ยงที่กำลังดูแล"
            value={pet.id}
            disabled={switching}
            onChange={(event) => void selectPet(event.target.value)}
          >
            {pets.map((item) => (
              <option key={item.id} value={item.id}>{item.name}</option>
            ))}
          </NeuSelect>
        </div>
      )}

      {adding && (
        <div className="mt-5 flex items-center justify-between rounded-xl bg-neu-bg px-4 py-3 text-sm font-semibold text-neu-accent">
          <span>เพิ่มสัตว์เลี้ยงตัวใหม่</span>
          <button type="button" className="neu-focusable text-neu-ink-muted" onClick={cancelAdding}>ยกเลิก</button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-5 flex flex-col gap-4">
        <NeuInput label="ชื่อสัตว์เลี้ยง" required value={name} onChange={(event) => setName(event.target.value)} />
        <NeuSelect label="ชนิดสัตว์เลี้ยง" value={species} onChange={(event) => { setSpecies(event.target.value); setBreed(null); }}>
          <option value="Dog">สุนัข</option>
          <option value="Cat">แมว</option>
        </NeuSelect>
        <BreedCombobox
          label="สายพันธุ์"
          species={species === "Cat" ? "Cat" : "Dog"}
          value={breed}
          onChange={setBreed}
        />
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
        <NeuButton type="submit" variant="accent" disabled={saving || switching}>
          {saving ? "กำลังบันทึก..." : adding ? "เพิ่มสัตว์เลี้ยง" : "บันทึกข้อมูล"}
        </NeuButton>
      </form>
    </NeuCard>
  );
}
