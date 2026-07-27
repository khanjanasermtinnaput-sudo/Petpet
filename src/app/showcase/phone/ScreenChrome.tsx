import type { ReactNode } from "react";

/** iOS status bar. Sits beside the Dynamic Island, so the middle is empty. */
export function StatusBar() {
  return (
    <div className="flex shrink-0 items-center justify-between px-6 pb-1 pt-3 text-[11px] font-semibold text-neu-ink">
      <span>9:41</span>
      <span className="flex items-center gap-1" aria-hidden>
        <span className="inline-flex items-end gap-[2px]">
          <i className="h-[4px] w-[3px] rounded-[1px] bg-neu-ink not-italic" />
          <i className="h-[6px] w-[3px] rounded-[1px] bg-neu-ink not-italic" />
          <i className="h-[8px] w-[3px] rounded-[1px] bg-neu-ink not-italic" />
          <i className="h-[10px] w-[3px] rounded-[1px] bg-neu-ink/30 not-italic" />
        </span>
        <span className="ml-1 inline-block h-[10px] w-[18px] rounded-[3px] border border-neu-ink/50 p-[1.5px]">
          <span className="block h-full w-2/3 rounded-[1px] bg-neu-ink" />
        </span>
      </span>
    </div>
  );
}

const NAV_ITEMS = [
  { label: "หน้าหลัก", icon: "🏠" },
  { label: "ประวัติ", icon: "📊" },
  { label: "AI สัตวแพทย์", icon: "💬" },
  { label: "ตั้งค่า", icon: "⚙️" },
] as const;

/** Mirrors NavRail's mobile layout — fixed bottom bar, active item inset. */
export function NavRail({ active }: { active: 0 | 1 | 2 | 3 }) {
  return (
    <nav className="mt-auto flex shrink-0 justify-around bg-neu-bg/90 px-2 py-2 backdrop-blur-sm">
      {NAV_ITEMS.map((item, i) => (
        <span
          key={item.label}
          className={`flex flex-col items-center gap-0.5 rounded-xl px-2 py-1.5 text-[9px] font-semibold ${
            i === active ? "neu-inset text-neu-accent" : "text-neu-ink-muted"
          }`}
        >
          <span className="text-base" aria-hidden>
            {item.icon}
          </span>
          {item.label}
        </span>
      ))}
    </nav>
  );
}

/** Shared column layout: status bar, scroll-free body, nav rail. */
export function Screen({
  active,
  children,
}: {
  active: 0 | 1 | 2 | 3;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col bg-neu-bg font-display">
      <StatusBar />
      {children}
      <NavRail active={active} />
    </div>
  );
}
