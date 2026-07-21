import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import type { Pet } from "./types";

export async function getCurrentUserPet(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<Pet | null> {
  const { data } = await supabase
    .from("pets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return data;
}

/** Reserve-tank capacity in grams. Not device-configurable yet — see AGENTS.md TODOs. */
export const TANK_CAPACITY_G = 1000;
