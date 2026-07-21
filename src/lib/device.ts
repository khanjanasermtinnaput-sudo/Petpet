import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./supabase/database.types";
import type { Pet } from "./types";

/**
 * Single-tenant MVP: exactly one device exists in the whole system, so
 * there's no per-user device claiming — the ESP32 firmware and the app
 * agree on this fixed ID out of band.
 */
export const DEVICE_ID = "PETFEEDER-001";

export async function getPet(supabase: SupabaseClient<Database>): Promise<Pet | null> {
  const { data } = await supabase.from("pets").select("*").limit(1).maybeSingle();
  return data;
}
