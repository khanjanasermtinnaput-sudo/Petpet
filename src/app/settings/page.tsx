import { NeuCard } from "@/components/neu/NeuCard";

export default function SettingsPage() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4 pb-24 md:pl-24 md:pb-4">
      <NeuCard className="w-full max-w-sm text-center">
        <h1 className="mb-2 text-xl font-bold text-neu-ink">ตั้งค่า</h1>
        <p className="text-sm text-neu-ink-muted">เร็วๆ นี้ — ตารางการให้อาหารและการตั้งค่าอุปกรณ์</p>
      </NeuCard>
    </main>
  );
}
