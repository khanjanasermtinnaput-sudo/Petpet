interface NeuProgressBarProps {
  valueG: number;
  capacityG: number;
  label: string;
}

export function NeuProgressBar({ valueG, capacityG, label }: NeuProgressBarProps) {
  const pct = capacityG > 0 ? Math.min(100, Math.max(0, (valueG / capacityG) * 100)) : 0;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-semibold text-neu-ink-muted">{label}</span>
        <span className="text-sm font-semibold text-neu-ink">
          {Math.round(valueG)}g <span className="text-neu-ink-muted">({Math.round(pct)}%)</span>
        </span>
      </div>
      <div className="neu-inset h-4 w-full overflow-hidden p-1">
        <div
          className="h-full rounded-full bg-neu-accent"
          style={{ width: `${pct}%`, transition: "width 400ms ease" }}
        />
      </div>
    </div>
  );
}
