import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "./supabase/database.types";
import type { Pet } from "./types";

export const ACTIVE_PET_COOKIE = "petpet-active-pet";

/** The selected pet belongs to this browser, not to a Supabase account. */
export async function getPet(supabase: SupabaseClient<Database>): Promise<Pet | null> {
  const activePetId = (await cookies()).get(ACTIVE_PET_COOKIE)?.value;
  if (activePetId) {
    const { data } = await supabase.from("pets").select("*").eq("id", activePetId).maybeSingle();
    if (data) return data;
  }

  const { data } = await supabase
    .from("pets")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

export async function getPets(supabase: SupabaseClient<Database>): Promise<Pet[]> {
  const { data } = await supabase.from("pets").select("*").order("created_at", { ascending: true });
  return data ?? [];
}