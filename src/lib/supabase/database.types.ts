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
          updated_at: string;
          uv_status: boolean;
        };
        Insert: {
          device_id: string;
          updated_at?: string;
          uv_status?: boolean;
        };
        Update: {
          device_id?: string;
          updated_at?: string;
          uv_status?: boolean;
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
      pets: {
        Row: {
          age_months: number;
          age_years: number;
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
      [_ in never]: never;
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
