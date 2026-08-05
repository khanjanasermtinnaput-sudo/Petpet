import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { getPet } from "@/lib/active-pet";
// Pet existence changes at runtime (onboarding submit) — must not be
// statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = await createClient();
  const pet = await getPet(supabase);

  redirect(pet ? "/dashboard" : "/onboarding");
}
