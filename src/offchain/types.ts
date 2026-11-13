import type { SupabaseClient } from "@supabase/supabase-js";

export const APPLICATION_ROLES = [
  "company_admin",
  "hr_operator",
  "employee",
  "auditor",
] as const;

export type ApplicationRole = (typeof APPLICATION_ROLES)[number];

export interface RecipientProfile {
  walletAddress: string;
  displayName: string;
  employeeReference: string | null;
  metadata: Record<string, unknown>;
}

export interface WalletSession {
  token: string;
  walletAddress: string;
  roles: ApplicationRole[];
  expiresAt: string;
}

export interface ContractSchedule {
  scheduleId: bigint;
  beneficiary: string;
  allocation: bigint;
  start: bigint;
  cliff: bigint;
  duration: bigint;
  released: bigint;
}

export interface OffchainDatabase {
  public: {
    Tables: {
      user_roles: {
        Row: {
          wallet_address: string;
          role: ApplicationRole;
          assigned_by: string;
          created_at: string;
        };
        Insert: {
          wallet_address: string;
          role: ApplicationRole;
          assigned_by: string;
        };
        Update: Partial<{
          wallet_address: string;
          role: ApplicationRole;
          assigned_by: string;
        }>;
        Relationships: [];
      };
      recipient_profiles: {
        Row: {
          wallet_address: string;
          display_name: string;
          employee_reference: string | null;
          metadata: Record<string, unknown>;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          wallet_address: string;
          display_name: string;
          employee_reference?: string | null;
          metadata?: Record<string, unknown>;
          created_by: string;
        };
        Update: Partial<{
          display_name: string;
          employee_reference: string | null;
          metadata: Record<string, unknown>;
        }>;
        Relationships: [];
      };
      auth_nonces: {
        Row: {
          wallet_address: string;
          nonce_hash: string;
          message: string;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          wallet_address: string;
          nonce_hash: string;
          message: string;
          expires_at: string;
        };
        Update: Partial<{
          wallet_address: string;
          nonce_hash: string;
          message: string;
          expires_at: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      application_role: ApplicationRole;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type DatabaseClient = SupabaseClient<OffchainDatabase>;
