"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NeuIcon, type NeuIconName } from "@/components/neu/NeuIcon";

const NAV_ITEMS = [
  { href: "/dashboard", label: "หน้าหลัก", icon: "home" },
  { href: "/history", label: "ประวัติ", icon: "history" },
  { href: "/vet", label: "VET AI", icon: "vet" },
  { href: "/settings", label: "ตั้งค่า", icon: "settings" },
] as const;

export function NavRail() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="เมนูหลัก"
      className="fixed inset-x-0 bottom-0 z-40 flex justify-around bg-neu-bg/90 px-2 py-2 backdrop-blur-sm md:inset-y-0 md:left-0 md:right-auto md:w-20 md:flex-col md:items-center md:justify-start md:gap-4 md:py-8"
    >
      {NAV_ITEMS.map((item) => {
        const active = pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`neu-focusable flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold ${
              active
                ? "neu-inset text-neu-accent"
                : "text-neu-ink-muted"
            }`}
          >
            <NeuIcon name={item.icon as NeuIconName} className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
