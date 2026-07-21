import { NeuCard } from "@/components/neu/NeuCard";
import { NeuProgressRing } from "@/components/neu/NeuProgressRing";

export function TrayHeroCard({
  trayWeightG,
  targetG,
}: {
  trayWeightG: number;
  targetG: number;
}) {
  return (
    <NeuCard className="flex flex-col items-center gap-4">
      <h2 className="text-sm font-semibold text-neu-ink-muted">อาหารในถาดตอนนี้</h2>
      <NeuProgressRing valueG={trayWeightG} targetG={targetG} />
    </NeuCard>
  );
}
