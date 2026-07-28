import type { Tables } from "./supabase/database.types";

export type Pet = Tables<"pets">;
export type FeederReading = Tables<"feeder_readings">;
export type DeviceStatus = Tables<"device_status">;

export type MealSlot = "breakfast" | "lunch" | "dinner";

export type FeedEvent = Omit<Tables<"feed_events">, "meal_slot"> & {
  meal_slot: MealSlot;
};

export type FeederCommandStatus = "pending" | "running" | "success" | "failed";
export type FeederCommandKind = "feed";
export type FeederCommandSource = "app" | "schedule" | "retry";

export type FeederCommand = Omit<
  Tables<"feeder_commands">,
  "command" | "meal_slot" | "source" | "status"
> & {
  command: FeederCommandKind;
  meal_slot: MealSlot;
  source: FeederCommandSource;
  status: FeederCommandStatus;
};

export type ScheduleSource = "manual" | "ai";

export type FeedingSchedule = Omit<Tables<"feeding_schedule">, "meal_slot" | "source"> & {
  meal_slot: MealSlot;
  source: ScheduleSource;
};
