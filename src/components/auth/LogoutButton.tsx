"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const supabase = createClient();

export function LogoutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleLogout() {
    setLoading(true);
    const { error } = await supabase.auth.signOut({ scope: "local" });

    if (error) {
      setLoading(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      aria-label="ออกจากระบบ"
      className="neu-focusable flex flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold text-neu-warning disabled:opacity-50"
    >
      <span className="text-lg" aria-hidden>
        ↪
      </span>
      {loading ? "กำลังออก..." : "ออกจากระบบ"}
    </button>
  );
}