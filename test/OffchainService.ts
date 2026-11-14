import { expect } from "chai";
import { getAddress } from "ethers";
import type { DatabaseClient, RecipientProfile } from "../src/offchain/types";
import { OffchainService } from "../src/offchain/service";

const USER_ID = "10000000-0000-0000-0000-000000000001";
const WALLET = "0x0000000000000000000000000000000000000001";

function mockDatabase(rows: RecipientProfile[]): DatabaseClient {
  return {
    from(table: string) {
      if (table !== "recipient_profiles") throw new Error(`Unexpected table: ${table}`);
      return {
        select: () => ({
          order: async () => ({
            data: rows.map((profile) => ({
              user_id: profile.userId,
              wallet_address: profile.walletAddress,
              display_name: profile.displayName,
              employee_reference: profile.employeeReference,
              metadata: profile.metadata,
            })),
            error: null,
          }),
          eq: (_column: string, walletAddress: string) => ({
            maybeSingle: async () => {
              const profile = rows.find((entry) => entry.walletAddress === walletAddress);
              return {
                data: profile
                  ? {
                      user_id: profile.userId,
                      wallet_address: profile.walletAddress,
                      display_name: profile.displayName,
                      employee_reference: profile.employeeReference,
                      metadata: profile.metadata,
                    }
                  : null,
                error: null,
              };
            },
          }),
        }),
      };
    },
  } as unknown as DatabaseClient;
}

describe("OffchainService", function () {
  const profile: RecipientProfile = {
    userId: USER_ID,
    walletAddress: WALLET,
    displayName: "Ada Lovelace",
    employeeReference: "EMP-001",
    metadata: { department: "Engineering" },
  };

  it("maps recipient profile rows", async function () {
    const service = new OffchainService(mockDatabase([profile]));

    expect(await service.listProfiles()).to.deep.equal([profile]);
  });

  it("normalizes wallet lookup before querying Supabase", async function () {
    const service = new OffchainService(mockDatabase([profile]));

    expect(await service.getProfile(getAddress(WALLET))).to.deep.equal(profile);
  });
});
