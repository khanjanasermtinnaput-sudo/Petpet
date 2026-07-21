import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Pet existence changes at runtime (onboarding submit) — must not be
// statically prerendered at build time.
export const dynamic = "force-dynamic";

export default async function RootPage() {
  const supabase = await createClient();
  const { data: pet } = await supabase.from("pets").select("id").limit(1).maybeSingle();

  redirect(pet ? "/dashboard" : "/onboarding");
}
