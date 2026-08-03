"use client";

import { useMemo, useState } from "react";
import { NeuInput } from "@/components/neu/NeuInput";
import { PET_BREEDS, type PetSpecies } from "@/lib/pet-breeds";

interface PetBreedSelectProps {
  species: PetSpecies;
  value: string;
  onChange: (value: string) => void;
}

export function PetBreedSelect({ species, value, onChange }: PetBreedSelectProps) {
  const [query, setQuery] = useState("");
  const breeds = PET_BREEDS[species];
  const filteredBreeds = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    if (!normalizedQuery) return breeds;
    return breeds.filter((breed) =>
      `${breed.label} ${breed.value}`.toLocaleLowerCase().includes(normalizedQuery),
    );
  }, [breeds, query]);

  return (
    <div className="flex flex-col gap-3">
      <NeuInput
        label="ค้นหาสายพันธุ์"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={`ค้นหาสายพันธุ์${species === "Dog" ? "สุนัข" : "แมว"}...`}
        autoComplete="off"
      />
      <div
        className="neu-inset grid max-h-48 gap-2 overflow-y-auto p-2 sm:grid-cols-2"
        role="listbox"
        aria-label="รายการสายพันธุ์"
      >
        {filteredBreeds.map((breed) => {
          const selected = value === breed.value;
          return (
            <button
              key={breed.value}
              type="button"
              role="option"
              aria-selected={selected}
              onClick={() => onChange(breed.value)}
              className={`neu-focusable rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                selected ? "neu-inset font-bold text-neu-accent" : "text-neu-ink-muted"
              }`}
            >
              {breed.label}
            </button>
          );
        })}
        {filteredBreeds.length === 0 && (
          <p className="col-span-full px-2 py-3 text-center text-sm text-neu-ink-muted">
            ไม่พบสายพันธุ์ที่ค้นหา
          </p>
        )}
      </div>
      {value && <p className="text-xs text-neu-ink-muted">เลือกแล้ว: {value}</p>}
    </div>
  );
}
