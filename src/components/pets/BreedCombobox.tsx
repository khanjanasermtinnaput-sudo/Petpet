"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { breedsForSpecies, type PetSpecies } from "@/lib/pet-breeds";

interface BreedComboboxProps {
  label: string;
  species: PetSpecies;
  value: string | null;
  onChange: (value: string | null) => void;
  required?: boolean;
  disabled?: boolean;
}

export function BreedCombobox({ label, species, value, onChange, required, disabled }: BreedComboboxProps) {
  const inputId = useId();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const options = breedsForSpecies(species);
  const selected = options.find((option) => option.value === value);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return normalized ? options.filter((option) => option.label.toLowerCase().includes(normalized)) : options;
  }, [options, query]);

  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  function choose(nextValue: string) {
    onChange(nextValue);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-semibold text-neu-ink-muted">{label}</label>
      <div className="relative">
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={open}
          aria-activedescendant={open && filtered[activeIndex] ? `${listId}-${filtered[activeIndex].value}` : undefined}
          className="neu-inset neu-focusable w-full border-none px-4 py-3 pr-10 text-neu-ink outline-none placeholder:text-neu-ink-muted/60"
          placeholder="ค้นหาสายพันธุ์..."
          value={open ? query : selected?.label ?? ""}
          required={required}
          disabled={disabled}
          onFocus={() => { setOpen(true); setQuery(""); setActiveIndex(0); }}
          onChange={(event) => { setOpen(true); setQuery(event.target.value); setActiveIndex(0); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.min(index + 1, Math.max(filtered.length - 1, 0))); }
            if (event.key === "ArrowUp") { event.preventDefault(); setOpen(true); setActiveIndex((index) => Math.max(index - 1, 0)); }
            if (event.key === "Enter" && open && filtered[activeIndex]) { event.preventDefault(); choose(filtered[activeIndex].value); }
            if (event.key === "Escape") { event.preventDefault(); setOpen(false); setQuery(""); }
          }}
        />
        <span aria-hidden className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-neu-ink-muted">⌄</span>
        {open && (
          <ul id={listId} role="listbox" aria-label={label} className="neu-raised absolute z-30 mt-2 max-h-56 w-full overflow-y-auto p-2">
            {filtered.length ? filtered.map((option, index) => (
              <li key={option.value} id={`${listId}-${option.value}`} role="option" aria-selected={value === option.value}>
                <button
                  type="button"
                  className={`neu-focusable w-full rounded-lg px-3 py-2 text-left text-sm ${index === activeIndex ? "bg-neu-accent/15 text-neu-accent" : "text-neu-ink"}`}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => choose(option.value)}
                >
                  {option.label}
                </button>
              </li>
            )) : <li className="px-3 py-2 text-sm text-neu-ink-muted">ไม่พบสายพันธุ์</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
