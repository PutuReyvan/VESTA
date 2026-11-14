import type { SupabaseClient } from "@supabase/supabase-js";

export const APPLICATION_ROLES = [
  "company_admin",
  "hr_operator",
  "employee",
  "auditor",
] as const;

export type ApplicationRole = (typeof APPLICATION_ROLES)[number];

export const ROLE_LABELS: Record<ApplicationRole, string> = {
  company_admin: "Company Admin",
  hr_operator: "HR Operator",
  employee: "Employee",
  auditor: "Auditor",
};

export function formatRole(role: ApplicationRole): string {
  return ROLE_LABELS[role];
}

export interface RecipientProfile {
  userId: string;
  walletAddress: string;
  displayName: string;
  employeeReference: string | null;
  metadata: Record<string, unknown>;
}

export interface UserRoleRecord {
  walletAddress: string;
  role: ApplicationRole;
  createdAt: string;
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
          user_id: string;
          role: ApplicationRole;
          assigned_by: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          role: ApplicationRole;
          assigned_by?: string;
        };
        Update: Partial<{
          user_id: string;
          role: ApplicationRole;
          assigned_by: string;
        }>;
        Relationships: [];
      };
      recipient_profiles: {
        Row: {
          user_id: string;
          wallet_address: string;
          display_name: string;
          employee_reference: string | null;
          metadata: Record<string, unknown>;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          user_id: string;
          wallet_address: string;
          display_name: string;
          employee_reference?: string | null;
          metadata?: Record<string, unknown>;
          created_by?: string;
        };
        Update: Partial<{
          user_id: string;
          wallet_address: string;
          display_name: string;
          employee_reference: string | null;
          metadata: Record<string, unknown>;
          created_by: string;
        }>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      has_role: {
        Args: { required_role: ApplicationRole };
        Returns: boolean;
      };
      ensure_default_employee_role: {
        Args: Record<string, never>;
        Returns: boolean;
      };
      assign_role_by_wallet: {
        Args: { target_wallet: string; target_role: ApplicationRole };
        Returns: string;
      };
      list_roles_with_wallets: {
        Args: Record<string, never>;
        Returns: Array<{
          wallet_address: string;
          role: ApplicationRole;
          created_at: string;
        }>;
      };
      remove_role_by_wallet: {
        Args: { target_wallet: string; target_role: ApplicationRole };
        Returns: undefined;
      };
    };
    Enums: {
      application_role: ApplicationRole;
    };
    CompositeTypes: Record<string, never>;
  };
}

export type DatabaseClient = SupabaseClient<OffchainDatabase>;
