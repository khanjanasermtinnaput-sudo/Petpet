interface NeuProgressRingProps {
  valueG: number;
  targetG: number;
  size?: number;
  strokeWidth?: number;
}

export function NeuProgressRing({
  valueG,
  targetG,
  size = 208,
  strokeWidth = 18,
}: NeuProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = targetG > 0 ? Math.min(1, Math.max(0, valueG / targetG)) : 0;
  const offset = circumference * (1 - pct);

  return (
    <div
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--neu-dark)"
          strokeOpacity={0.5}
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--neu-accent)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-4xl font-bold text-neu-ink">{Math.round(valueG)}g</span>
        <span className="text-sm text-neu-ink-muted">/{Math.round(targetG)}g</span>
      </div>
    </div>
  );
}
