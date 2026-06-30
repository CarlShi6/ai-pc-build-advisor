import type { CustomerNeeds } from "@/types/api";
import type {
  Build,
  BuildFeedbackBoolean,
  BuildFeedbackDifficulty,
  BuildFeedbackIssueLevel,
} from "@/types/build";
import type { AffiliateMerchant, PlanType } from "@/types/monetization";
import type { Part } from "@/types/parts";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      app_users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          auth_provider: "mock" | "supabase";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          auth_provider?: "mock" | "supabase";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          display_name?: string | null;
          auth_provider?: "mock" | "supabase";
          updated_at?: string;
        };
        Relationships: [];
      };
      saved_builds: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string;
          name: string;
          build: Build;
          build_needs: CustomerNeeds;
          total_price: number;
          compatibility_status: Build["compatibilityStatus"];
          owned_parts: number;
          target_use_case: string[];
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["saved_builds"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["saved_builds"]["Row"], "id">>;
        Relationships: [];
      };
      entitlements: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string;
          plan: PlanType;
          build_id: string | null;
          active: boolean;
          payment_provider: "mock" | "stripe";
          checkout_session_id: string | null;
          activated_at: string | null;
          started_at: string;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["entitlements"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["entitlements"]["Row"], "id">>;
        Relationships: [];
      };
      usage_counters: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string;
          build_id: string | null;
          counter_date: string;
          ai_questions_used_today: number;
          ai_questions_used_for_build: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["usage_counters"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["usage_counters"]["Row"], "id">>;
        Relationships: [];
      };
      replacement_counters: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string;
          build_id: string | null;
          replacements_used_for_build: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["replacement_counters"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["replacement_counters"]["Row"], "id">>;
        Relationships: [];
      };
      owned_parts: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string;
          build_id: string | null;
          part: Part;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["owned_parts"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["owned_parts"]["Row"], "id">>;
        Relationships: [];
      };
      post_build_feedback: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string;
          build_id: string;
          completed_at: string;
          boot_success: BuildFeedbackBoolean;
          installation_difficulty: BuildFeedbackDifficulty;
          compatibility_issues: BuildFeedbackIssueLevel;
          thermal_experience: BuildFeedbackIssueLevel;
          noise_experience: BuildFeedbackIssueLevel;
          cable_management_experience: BuildFeedbackIssueLevel;
          gpu_clearance_issue: BuildFeedbackIssueLevel;
          cooler_fit_issue: BuildFeedbackIssueLevel;
          bios_update_needed: BuildFeedbackBoolean;
          driver_issue: BuildFeedbackIssueLevel;
          overall_satisfaction: number;
          would_recommend: BuildFeedbackBoolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["post_build_feedback"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["post_build_feedback"]["Row"], "id">>;
        Relationships: [];
      };
      affiliate_clicks: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string;
          build_id: string | null;
          part_id: string;
          merchant: AffiliateMerchant;
          url: string;
          clicked_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["affiliate_clicks"]["Row"], "id"> & {
          id?: string;
        };
        Update: never;
        Relationships: [];
      };
      checkout_sessions: {
        Row: {
          id: string;
          user_id: string | null;
          session_id: string;
          plan: PlanType;
          payment_provider: "mock" | "stripe";
          checkout_session_id: string | null;
          status: "created" | "completed" | "cancelled" | "failed";
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["checkout_sessions"]["Row"], "id"> & {
          id?: string;
        };
        Update: Partial<Omit<Database["public"]["Tables"]["checkout_sessions"]["Row"], "id">>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
