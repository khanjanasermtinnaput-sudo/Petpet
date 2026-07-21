import { NeuCard } from "@/components/neu/NeuCard";
import { NeuProgressBar } from "@/components/neu/NeuProgressBar";
import { TANK_CAPACITY_G } from "@/lib/device";

export function TankCard({ tankWeightG }: { tankWeightG: number }) {
  return (
    <NeuCard>
      <NeuProgressBar valueG={tankWeightG} capacityG={TANK_CAPACITY_G} label="ถังสำรองอาหาร" />
    </NeuCard>
  );
}
