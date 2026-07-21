interface NeuPillProps {
  active: boolean;
  activeLabel: string;
  inactiveLabel: string;
}

export function NeuPill({ active, activeLabel, inactiveLabel }: NeuPillProps) {
  return (
    <div className="neu-raised-sm flex items-center gap-2 px-4 py-2">
      <span
        className={`h-2.5 w-2.5 rounded-full ${
          active ? "bg-neu-accent shadow-[0_0_8px_var(--neu-accent)]" : "bg-neu-ink-muted/40"
        }`}
        aria-hidden
      />
      <span className="text-sm font-semibold text-neu-ink">
        {active ? activeLabel : inactiveLabel}
      </span>
    </div>
  );
}
