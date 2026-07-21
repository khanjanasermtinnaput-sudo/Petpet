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
        Relationships: [
          {
            foreignKeyName: "device_status_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: true;
            referencedRelation: "devices";
            referencedColumns: ["device_id"];
          },
        ];
      };
      devices: {
        Row: {
          claimed_at: string;
          device_id: string;
          user_id: string;
        };
        Insert: {
          claimed_at?: string;
          device_id: string;
          user_id: string;
        };
        Update: {
          claimed_at?: string;
          device_id?: string;
          user_id?: string;
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
        Relationships: [
          {
            foreignKeyName: "feed_events_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["device_id"];
          },
        ];
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
        Relationships: [
          {
            foreignKeyName: "feeder_readings_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["device_id"];
          },
        ];
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
          user_id: string;
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
          species: string;
          user_id: string;
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
          user_id?: string;
          weight_kg?: number;
        };
        Relationships: [
          {
            foreignKeyName: "pets_device_id_fkey";
            columns: ["device_id"];
            isOneToOne: false;
            referencedRelation: "devices";
            referencedColumns: ["device_id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      owns_device: { Args: { d: string }; Returns: boolean };
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
