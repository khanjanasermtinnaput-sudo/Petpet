export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      device_status: {
        Row: {
          device_id: string;
          firmware_version: string | null;
          last_feed_at: string | null;
          last_seen_at: string | null;
          updated_at: string;
          uv_status: boolean;
          wifi_rssi: number | null;
        };
        Insert: {
          device_id: string;
          firmware_version?: string | null;
          last_feed_at?: string | null;
          last_seen_at?: string | null;
          updated_at?: string;
          uv_status?: boolean;
          wifi_rssi?: number | null;
        };
        Update: {
          device_id?: string;
          firmware_version?: string | null;
          last_feed_at?: string | null;
          last_seen_at?: string | null;
          updated_at?: string;
          uv_status?: boolean;
          wifi_rssi?: number | null;
        };
        Relationships: [];
      };
      devices: {
        Row: {
          created_at: string;
          device_id: string;
          label: string;
          secret_hash: string;
        };
        Insert: {
          created_at?: string;
          device_id: string;
          label?: string;
          secret_hash: string;
        };
        Update: {
          created_at?: string;
          device_id?: string;
          label?: string;
          secret_hash?: string;
        };
        Relationships: [];
      };
      feed_events: {
        Row: {
          actual_eaten_g: number;
          device_id: string;
          id: string;
          meal_slot: string;
          target_g: number;
          ts: string;
        };
        Insert: {
          actual_eaten_g?: number;
          device_id: string;
          id?: string;
          meal_slot: string;
          target_g: number;
          ts?: string;
        };
        Update: {
          actual_eaten_g?: number;
          device_id?: string;
          id?: string;
          meal_slot?: string;
          target_g?: number;
          ts?: string;
        };
        Relationships: [];
      };
      feeder_commands: {
        Row: {
          attempts: number;
          command: string;
          created_at: string;
          device_id: string;
          dispensed_g: number | null;
          error: string | null;
          executed_at: string | null;
          feed_event_id: string | null;
          finished_at: string | null;
          id: string;
          meal_slot: string;
          retry_of: string | null;
          source: string;
          status: string;
          target_g: number;
          tray_after_g: number | null;
          tray_before_g: number | null;
          updated_at: string;
        };
        Insert: {
          attempts?: number;
          command?: string;
          created_at?: string;
          device_id: string;
          dispensed_g?: number | null;
          error?: string | null;
          executed_at?: string | null;
          feed_event_id?: string | null;
          finished_at?: string | null;
          id?: string;
          meal_slot: string;
          retry_of?: string | null;
          source?: string;
          status?: string;
          target_g: number;
          tray_after_g?: number | null;
          tray_before_g?: number | null;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          command?: string;
          created_at?: string;
          device_id?: string;
          dispensed_g?: number | null;
          error?: string | null;
          executed_at?: string | null;
          feed_event_id?: string | null;
          finished_at?: string | null;
          id?: string;
          meal_slot?: string;
          retry_of?: string | null;
          source?: string;
          status?: string;
          target_g?: number;
          tray_after_g?: number | null;
          tray_before_g?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      feeder_readings: {
        Row: {
          device_id: string;
          id: string;
          recorded_at: string;
          tank_weight_g: number;
          tray_weight_g: number;
        };
        Insert: {
          device_id: string;
          id?: string;
          recorded_at?: string;
          tank_weight_g: number;
          tray_weight_g: number;
        };
        Update: {
          device_id?: string;
          id?: string;
          recorded_at?: string;
          tank_weight_g?: number;
          tray_weight_g?: number;
        };
        Relationships: [];
      };
      feeding_schedule: {
        Row: {
          device_id: string;
          id: string;
          meal_slot: string;
          source: string;
          target_g: number;
          time_of_day: string;
          updated_at: string;
        };
        Insert: {
          device_id: string;
          id?: string;
          meal_slot: string;
          source?: string;
          target_g: number;
          time_of_day: string;
          updated_at?: string;
        };
        Update: {
          device_id?: string;
          id?: string;
          meal_slot?: string;
          source?: string;
          target_g?: number;
          time_of_day?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      pets: {
        Row: {
          age_months: number;
          age_years: number;
          birth_date: string | null;
          created_at: string;
          daily_target_g: number;
          device_id: string;
          id: string;
          name: string;
          species: string;
          weight_kg: number;
        };
        Insert: {
          age_months?: number;
          age_years?: number;
          birth_date?: string | null;
          created_at?: string;
          daily_target_g?: number;
          device_id: string;
          id?: string;
          name: string;
          species?: string;
          weight_kg: number;
        };
        Update: {
          age_months?: number;
          age_years?: number;
          birth_date?: string | null;
          created_at?: string;
          daily_target_g?: number;
          device_id?: string;
          id?: string;
          name?: string;
          species?: string;
          weight_kg?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      device_health: {
        Args: { p_device_id: string };
        Returns: Json;
      };
      device_poll_command: {
        Args: { p_device_id: string; p_secret: string };
        Returns: Json;
      };
      device_report_consumption: {
        Args: {
          p_command_id: string;
          p_device_id: string;
          p_secret: string;
          p_tray_weight_g: number;
        };
        Returns: Json;
      };
      device_report_reading: {
        Args: {
          p_device_id: string;
          p_firmware_version?: string;
          p_secret: string;
          p_tank_weight_g: number;
          p_tray_weight_g: number;
          p_uv_status?: boolean;
          p_wifi_rssi?: number;
        };
        Returns: Json;
      };
      device_report_result: {
        Args: {
          p_command_id: string;
          p_device_id: string;
          p_dispensed_g?: number;
          p_error?: string;
          p_secret: string;
          p_success: boolean;
          p_tray_weight_g?: number;
        };
        Returns: Json;
      };
      enqueue_feed_command: {
        Args: {
          p_device_id: string;
          p_meal_slot: string;
          p_retry_of?: string;
          p_source?: string;
          p_target_g: number;
        };
        // `returns public.feeder_commands` — a single row, which is why this
        // one is spelled out rather than left as Json: it's the only RPC the
        // app itself calls, so `command.id` and `command.status` type-check.
        Returns: Database["public"]["Tables"]["feeder_commands"]["Row"];
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DefaultSchema = Database["public"];

export type Tables<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof DefaultSchema["Tables"]> =
  DefaultSchema["Tables"][T]["Update"];
