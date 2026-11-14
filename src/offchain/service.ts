import { getAddress } from "ethers";
import type {
  ApplicationRole,
  DatabaseClient,
  RecipientProfile,
  UserRoleRecord,
} from "./types";

function wallet(value: string): string {
  return getAddress(value).toLowerCase();
}

function profileRow(profile: RecipientProfile) {
  return {
    user_id: profile.userId,
    wallet_address: wallet(profile.walletAddress),
    display_name: profile.displayName,
    employee_reference: profile.employeeReference,
    metadata: profile.metadata,
  };
}

export class OffchainService {
  constructor(private readonly database: DatabaseClient) {}

  async listProfiles(): Promise<RecipientProfile[]> {
    const { data, error } = await this.database
      .from("recipient_profiles")
      .select("user_id, wallet_address, display_name, employee_reference, metadata")
      .order("display_name");
    if (error) throw new Error(`Unable to list recipient profiles: ${error.message}`);
    return data.map((profile) => ({
      userId: profile.user_id,
      walletAddress: profile.wallet_address,
      displayName: profile.display_name,
      employeeReference: profile.employee_reference,
      metadata: profile.metadata,
    }));
  }

  async getProfile(walletAddress: string): Promise<RecipientProfile | null> {
    const { data, error } = await this.database
      .from("recipient_profiles")
      .select("user_id, wallet_address, display_name, employee_reference, metadata")
      .eq("wallet_address", wallet(walletAddress))
      .maybeSingle();
    if (error) throw new Error(`Unable to read recipient profile: ${error.message}`);
    return data
      ? {
          userId: data.user_id,
          walletAddress: data.wallet_address,
          displayName: data.display_name,
          employeeReference: data.employee_reference,
          metadata: data.metadata,
        }
      : null;
  }

  async upsertProfile(profile: RecipientProfile): Promise<RecipientProfile> {
    const { data, error } = await this.database
      .from("recipient_profiles")
      .upsert(profileRow(profile))
      .select("user_id, wallet_address, display_name, employee_reference, metadata")
      .single();
    if (error) throw new Error(`Unable to save recipient profile: ${error.message}`);
    return {
      userId: data.user_id,
      walletAddress: data.wallet_address,
      displayName: data.display_name,
      employeeReference: data.employee_reference,
      metadata: data.metadata,
    };
  }

  async assignRole(walletAddress: string, role: ApplicationRole): Promise<void> {
    const { error } = await this.database.rpc("assign_role_by_wallet", {
      target_wallet: wallet(walletAddress),
      target_role: role,
    });
    if (error) throw new Error(`Unable to assign role: ${error.message}`);
  }

  async listRoles(): Promise<UserRoleRecord[]> {
    const { data, error } = await this.database.rpc("list_roles_with_wallets");
    if (error) throw new Error(`Unable to list roles: ${error.message}`);
    return data.map((entry) => ({
      walletAddress: entry.wallet_address,
      role: entry.role,
      createdAt: entry.created_at,
    }));
  }

  async removeRole(walletAddress: string, role: ApplicationRole): Promise<void> {
    const { error } = await this.database.rpc("remove_role_by_wallet", {
      target_wallet: wallet(walletAddress),
      target_role: role,
    });
    if (error) throw new Error(`Unable to remove role: ${error.message}`);
  }

  async removeProfile(userId: string): Promise<void> {
    const { error } = await this.database
      .from("recipient_profiles")
      .delete()
      .eq("user_id", userId);
    if (error) throw new Error(`Unable to delete recipient profile: ${error.message}`);
  }
}
