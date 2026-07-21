import type { Tables } from "./supabase/database.types";

export type Device = Tables<"devices">;
export type Pet = Tables<"pets">;
export type FeederReading = Tables<"feeder_readings">;
export type DeviceStatus = Tables<"device_status">;

export type MealSlot = "breakfast" | "lunch" | "dinner";

export type FeedEvent = Omit<Tables<"feed_events">, "meal_slot"> & {
  meal_slot: MealSlot;
};
