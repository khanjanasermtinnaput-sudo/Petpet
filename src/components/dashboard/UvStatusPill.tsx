import { NeuPill } from "@/components/neu/NeuPill";

export function UvStatusPill({ uvOn }: { uvOn: boolean }) {
  return (
    <NeuPill active={uvOn} activeLabel="UV กำลังฆ่าเชื้อ" inactiveLabel="UV ปิดอยู่" />
  );
}
