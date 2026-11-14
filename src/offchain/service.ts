import { getAddress } from "ethers";
import type {
  DatabaseClient,
  RecipientProfile,
  ApplicationRole,
  WalletSession,
} from "./types";
import { WalletAuthService } from "./walletAuth";
import { ContractDataService } from "./contractData";

function wallet(value: string): string {
  return getAddress(value).toLowerCase();
}

export class OffchainService {
  readonly auth: WalletAuthService;
  readonly contract: ContractDataService;

  constructor(
    private readonly database: DatabaseClient,
    options: { sessionSecret: string; rpcUrl: string; managerAddress: string },
  ) {
    this.auth = new WalletAuthService(database, options.sessionSecret);
    this.contract = new ContractDataService(options.rpcUrl, options.managerAddress);
  }

  async listProfiles(): Promise<RecipientProfile[]> {
    const { data, error } = await this.database
      .from("recipient_profiles")
      .select("wallet_address, display_name, employee_reference, metadata")
      .order("display_name");
    if (error) throw new Error(`Unable to list recipient profiles: ${error.message}`);
    return data.map((profile) => ({
      walletAddress: profile.wallet_address,
      displayName: profile.display_name,
      employeeReference: profile.employee_reference,
      metadata: profile.metadata,
    }));
  }

  async getProfile(walletAddress: string): Promise<RecipientProfile | null> {
    const { data, error } = await this.database
      .from("recipient_profiles")
      .select("wallet_address, display_name, employee_reference, metadata")
      .eq("wallet_address", wallet(walletAddress))
      .maybeSingle();
    if (error) throw new Error(`Unable to read recipient profile: ${error.message}`);
    return data ? {
      walletAddress: data.wallet_address,
      displayName: data.display_name,
      employeeReference: data.employee_reference,
      metadata: data.metadata,
    } : null;
  }

  async upsertProfile(
    session: Omit<WalletSession, "token">,
    profile: Omit<RecipientProfile, "walletAddress"> & { walletAddress: string },
  ): Promise<RecipientProfile> {
    await this.auth.requireAnyRole(session, ["company_admin", "hr_operator"]);
    const { data, error } = await this.database
      .from("recipient_profiles")
      .upsert({
        wallet_address: wallet(profile.walletAddress),
        display_name: profile.displayName,
        employee_reference: profile.employeeReference,
        metadata: profile.metadata,
        created_by: wallet(session.walletAddress),
      })
      .select("wallet_address, display_name, employee_reference, metadata")
      .single();
    if (error) throw new Error(`Unable to save recipient profile: ${error.message}`);
    return {
      walletAddress: data.wallet_address,
      displayName: data.display_name,
      employeeReference: data.employee_reference,
      metadata: data.metadata,
    };
  }

  async assignRole(
    session: Omit<WalletSession, "token">,
    walletAddress: string,
    role: ApplicationRole,
  ): Promise<void> {
    await this.auth.requireRole(session, "company_admin");
    const { error } = await this.database.from("user_roles").insert({
      wallet_address: wallet(walletAddress),
      role,
      assigned_by: wallet(session.walletAddress),
    });
    if (error) throw new Error(`Unable to assign role: ${error.message}`);
  }

  async removeProfile(session: Omit<WalletSession, "token">, walletAddress: string): Promise<void> {
    await this.auth.requireAnyRole(session, ["company_admin", "hr_operator"]);
    const { error } = await this.database
      .from("recipient_profiles")
      .delete()
      .eq("wallet_address", wallet(walletAddress));
    if (error) throw new Error(`Unable to delete recipient profile: ${error.message}`);
  }
}
