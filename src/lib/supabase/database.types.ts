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
      chat_conversations: {
        Row: {
          created_at: string;
          id: string;
          pet_id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          pet_id: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          pet_id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      chat_messages: {
        Row: {
          client_message_id: string | null;
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          image_mime_type: string | null;
          image_path: string | null;
          role: string;
        };
        Insert: {
          client_message_id?: string | null;
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          image_mime_type?: string | null;
          image_path?: string | null;
          role: string;
        };
        Update: {
          client_message_id?: string | null;
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          image_mime_type?: string | null;
          image_path?: string | null;
          role?: string;
        };
        Relationships: [];
      };
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
          pet_id: string;
          target_g: number;
          ts: string;
        };
        Insert: {
          actual_eaten_g?: number;
          device_id: string;
          id?: string;
          meal_slot: string;
          pet_id: string;
          target_g: number;
          ts?: string;
        };
        Update: {
          actual_eaten_g?: number;
          device_id?: string;
          id?: string;
          meal_slot?: string;
          pet_id?: string;
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
          pet_id: string;
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
          pet_id: string;
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
          pet_id?: string;
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
          pet_id: string;
          source: string;
          target_g: number;
          time_of_day: string;
          updated_at: string;
        };
        Insert: {
          device_id: string;
          id?: string;
          meal_slot: string;
          pet_id: string;
          source?: string;
          target_g: number;
          time_of_day: string;
          updated_at?: string;
        };
        Update: {
          device_id?: string;
          id?: string;
          meal_slot?: string;
          pet_id?: string;
          source?: string;
          target_g?: number;
          time_of_day?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      launcher_commands: {
        Row: {
          attempts: number;
          command: string;
          created_at: string;
          device_id: string;
          error: string | null;
          executed_at: string | null;
          finished_at: string | null;
          id: string;
          interval_ms: number;
          launched_count: number;
          pitch_deg: number;
          shuttle_count: number;
          speed_pct: number;
          status: string;
          stop_requested: boolean;
          updated_at: string;
          yaw_deg: number;
        };
        Insert: {
          attempts?: number;
          command?: string;
          created_at?: string;
          device_id: string;
          error?: string | null;
          executed_at?: string | null;
          finished_at?: string | null;
          id?: string;
          interval_ms: number;
          launched_count?: number;
          pitch_deg: number;
          shuttle_count: number;
          speed_pct: number;
          status?: string;
          stop_requested?: boolean;
          updated_at?: string;
          yaw_deg: number;
        };
        Update: {
          attempts?: number;
          command?: string;
          created_at?: string;
          device_id?: string;
          error?: string | null;
          executed_at?: string | null;
          finished_at?: string | null;
          id?: string;
          interval_ms?: number;
          launched_count?: number;
          pitch_deg?: number;
          shuttle_count?: number;
          speed_pct?: number;
          status?: string;
          stop_requested?: boolean;
          updated_at?: string;
          yaw_deg?: number;
        };
        Relationships: [];
      };
      launcher_status: {
        Row: {
          battery_pct: number | null;
          device_id: string;
          firmware_version: string | null;
          last_error: string | null;
          last_seen_at: string | null;
          motor_temp_c: number | null;
          shuttles_left: number | null;
          state: string;
          updated_at: string;
          wifi_rssi: number | null;
        };
        Insert: {
          battery_pct?: number | null;
          device_id: string;
          firmware_version?: string | null;
          last_error?: string | null;
          last_seen_at?: string | null;
          motor_temp_c?: number | null;
          shuttles_left?: number | null;
          state?: string;
          updated_at?: string;
          wifi_rssi?: number | null;
        };
        Update: {
          battery_pct?: number | null;
          device_id?: string;
          firmware_version?: string | null;
          last_error?: string | null;
          last_seen_at?: string | null;
          motor_temp_c?: number | null;
          shuttles_left?: number | null;
          state?: string;
          updated_at?: string;
          wifi_rssi?: number | null;
        };
        Relationships: [];
      };
      pets: {
        Row: {
          age_months: number;
          age_years: number;
          birth_date: string | null;
          breed: string | null;
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
          breed?: string | null;
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
          breed?: string | null;
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
          p_pet_id: string;
          p_retry_of?: string;
          p_source?: string;
          p_target_g: number;
        };
        // `returns public.feeder_commands` — a single row, which is why this
        // one is spelled out rather than left as Json: it's the only RPC the
        // app itself calls, so `command.id` and `command.status` type-check.
        Returns: Database["public"]["Tables"]["feeder_commands"]["Row"];
      };
      device_poll_launcher_command: {
        Args: { p_device_id: string; p_secret: string };
        Returns: Json;
      };
      device_report_launcher_progress: {
        Args: {
          p_command_id: string;
          p_device_id: string;
          p_launched_count: number;
          p_secret: string;
        };
        Returns: Json;
      };
      device_report_launcher_result: {
        Args: {
          p_command_id: string;
          p_device_id: string;
          p_error?: string;
          p_launched_count?: number;
          p_secret: string;
          p_success: boolean;
        };
        Returns: Json;
      };
      device_report_launcher_state: {
        Args: {
          p_battery_pct?: number;
          p_device_id: string;
          p_firmware_version?: string;
          p_last_error?: string;
          p_motor_temp_c?: number;
          p_secret: string;
          p_shuttles_left?: number;
          p_state: string;
          p_wifi_rssi?: number;
        };
        Returns: Json;
      };
      enqueue_launcher_command: {
        Args: {
          p_device_id: string;
          p_interval_ms: number;
          p_pitch_deg: number;
          p_shuttle_count: number;
          p_speed_pct: number;
          p_yaw_deg: number;
        };
        Returns: Database["public"]["Tables"]["launcher_commands"]["Row"];
      };
      launcher_health: {
        Args: { p_device_id: string };
        Returns: Json;
      };
      request_launcher_stop: {
        Args: { p_device_id: string };
        Returns: Database["public"]["Tables"]["launcher_commands"]["Row"];
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
