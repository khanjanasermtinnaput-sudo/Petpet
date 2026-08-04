"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/auth/LogoutButton";

const NAV_ITEMS = [
  { href: "/dashboard", label: "หน้าหลัก", icon: "🏠" },
  { href: "/history", label: "ประวัติ", icon: "📊" },
  { href: "/vet", label: "AI สัตวแพทย์", icon: "💬" },
  { href: "/settings", label: "ตั้งค่า", icon: "⚙️" },
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
            <span className="text-lg" aria-hidden>
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
      <LogoutButton />
    </nav>
  );
}
