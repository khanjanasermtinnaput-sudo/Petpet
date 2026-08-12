import Link from "next/link";
import { NeuIcon } from "@/components/neu/NeuIcon";
import { NeuThemeToggle } from "@/components/neu/NeuThemeToggle";

export function TopBar({ petName }: { petName: string }) {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between bg-neu-bg/90 px-4 py-4 backdrop-blur-sm sm:px-8">
      <div className="flex items-center gap-3">
        <div
          className="neu-raised-round flex h-11 w-11 items-center justify-center text-xl"
          aria-hidden
        >
          <span className="text-base font-black text-neu-accent">P</span>
        </div>
        <span className="text-lg font-bold text-neu-ink">{petName}</span>
      </div>
      <div className="flex items-center gap-3">
        <NeuThemeToggle />
        <Link
          href="/onboarding"
          className="neu-raised-sm neu-focusable neu-press-active flex items-center gap-2 px-4 py-2 text-sm font-semibold text-neu-ink"
        >
          <NeuIcon name="logout" className="h-4 w-4" />
          ออกจากระบบ
        </Link>
      </div>
    </header>
  );
}
