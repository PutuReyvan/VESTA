import { expect } from "chai";
import {
  getAuthAccessState,
  type IdentityInitializationStatus,
} from "../src/features/auth/AuthContext";

function accessState({
  loading = false,
  authenticated = true,
  identityStatus = "ready",
  roleCount = 1,
}: {
  loading?: boolean;
  authenticated?: boolean;
  identityStatus?: IdentityInitializationStatus;
  roleCount?: number;
} = {}) {
  return getAuthAccessState({
    loading,
    authenticated,
    identityStatus,
    roleCount,
  });
}

describe("auth access state", function () {
  it("keeps the login page available without a session", function () {
    expect(accessState({ authenticated: false, identityStatus: "error", roleCount: 0 }))
      .to.equal("login");
  });

  it("keeps protected content closed while identity initialization is incomplete", function () {
    expect(accessState({ identityStatus: "idle" })).to.equal("loading");
    expect(accessState({ identityStatus: "loading" })).to.equal("loading");
    expect(accessState({ loading: true })).to.equal("loading");
  });

  it("shows identity initialization failures instead of protected content", function () {
    expect(accessState({ identityStatus: "error", roleCount: 0 }))
      .to.equal("identity-error");
  });

  it("denies protected content to a verified user with zero roles", function () {
    expect(accessState({ roleCount: 0 })).to.equal("no-role");
  });

  it("allows protected content only after identity and roles are ready", function () {
    expect(accessState()).to.equal("authorized");
  });
});
