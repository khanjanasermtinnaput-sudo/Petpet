import { UvStatusPill } from "./UvStatusPill";

export function TopBar({ petName, uvOn }: { petName: string; uvOn: boolean }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between bg-neu-bg/90 px-4 py-4 backdrop-blur-sm sm:px-8">
      <div className="flex items-center gap-3">
        <div
          className="neu-raised-round flex h-11 w-11 items-center justify-center text-xl"
          aria-hidden
        >
          🐾
        </div>
        <span className="text-lg font-bold text-neu-ink">{petName}</span>
      </div>
      <UvStatusPill uvOn={uvOn} />
    </header>
  );
}
