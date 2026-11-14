import { strict as assert } from "node:assert";
import { expect } from "chai";
import { OffchainService } from "../src/offchain/service";
import type {
  ApplicationRole,
  DatabaseClient,
  RecipientProfile,
  WalletSession,
} from "../src/offchain/types";

const EMPLOYEE_WALLET = "0x0000000000000000000000000000000000000001";
const OTHER_WALLET = "0x0000000000000000000000000000000000000002";
const MANAGER_ADDRESS = "0x0000000000000000000000000000000000000003";

function session(walletAddress: string): Omit<WalletSession, "token"> {
  return {
    walletAddress,
    roles: [],
    expiresAt: "2099-01-01T00:00:00.000Z",
  };
}

function mockDatabase(
  roles: ApplicationRole[],
  profiles: RecipientProfile[],
): DatabaseClient {
  return {
    from(table: string) {
      if (table === "user_roles") {
        return {
          select: () => ({
            eq: async () => ({
              data: roles.map((role) => ({ role })),
              error: null,
            }),
          }),
        };
      }

      if (table === "recipient_profiles") {
        return {
          select: () => ({
            order: async () => ({
              data: profiles.map((profile) => ({
                wallet_address: profile.walletAddress,
                display_name: profile.displayName,
                employee_reference: profile.employeeReference,
                metadata: profile.metadata,
              })),
              error: null,
            }),
            eq: (_column: string, walletAddress: string) => ({
              maybeSingle: async () => {
                const profile = profiles.find(
                  (entry) => entry.walletAddress === walletAddress,
                );
                return {
                  data: profile
                    ? {
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
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  } as unknown as DatabaseClient;
}

function serviceFor(
  roles: ApplicationRole[],
  profiles: RecipientProfile[] = [],
): OffchainService {
  return new OffchainService(mockDatabase(roles, profiles), {
    sessionSecret: "test-session-secret-must-be-at-least-32-characters",
    rpcUrl: "http://127.0.0.1:8545",
    managerAddress: MANAGER_ADDRESS,
  });
}

describe("OffchainService profile access", function () {
  const profile: RecipientProfile = {
    walletAddress: EMPLOYEE_WALLET,
    displayName: "Ada Lovelace",
    employeeReference: "EMP-001",
    metadata: {},
  };

  it("blocks employees from listing every profile", async function () {
    const service = serviceFor(["employee"], [profile]);

    await assert.rejects(
      service.listProfiles(session(EMPLOYEE_WALLET)),
      /One of these roles is required/,
    );
  });

  it("allows an employee to read only their own profile", async function () {
    const service = serviceFor(["employee"], [profile]);

    expect(await service.getProfile(session(EMPLOYEE_WALLET), EMPLOYEE_WALLET))
      .to.deep.equal(profile);
    await assert.rejects(
      service.getProfile(session(EMPLOYEE_WALLET), OTHER_WALLET),
      /One of these roles is required/,
    );
  });

  it("allows an auditor to list profiles", async function () {
    const service = serviceFor(["auditor"], [profile]);

    expect(await service.listProfiles(session(OTHER_WALLET))).to.deep.equal([
      profile,
    ]);
  });
});
