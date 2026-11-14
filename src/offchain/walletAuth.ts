import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getAddress, verifyMessage } from "ethers";
import type { DatabaseClient, ApplicationRole, WalletSession } from "./types";

const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_SECONDS = 60 * 60;

function normalizeWallet(walletAddress: string): string {
  return getAddress(walletAddress).toLowerCase();
}

function encode(value: string): string {
  return Buffer.from(value).toString("base64url");
}

export class WalletAuthService {
  constructor(
    private readonly database: DatabaseClient,
    private readonly sessionSecret: string,
    private readonly appName = "VESTA",
  ) {
    if (sessionSecret.length < 32) {
      throw new Error("VESTA_SESSION_SECRET must be at least 32 characters");
    }
  }

  async createChallenge(walletAddress: string): Promise<string> {
    const wallet = normalizeWallet(walletAddress);
    const nonce = randomBytes(32).toString("hex");
    const message = [
      `${this.appName} wallet sign-in`,
      "",
      `Wallet: ${wallet}`,
      `Nonce: ${nonce}`,
      "This signature does not authorize token transfers.",
    ].join("\n");
    const expiresAt = new Date(Date.now() + NONCE_TTL_MS).toISOString();
    const { error } = await this.database.from("auth_nonces").upsert({
      wallet_address: wallet,
      nonce_hash: createHash("sha256").update(nonce).digest("hex"),
      message,
      expires_at: expiresAt,
    });
    if (error) throw new Error(`Unable to create wallet challenge: ${error.message}`);
    return message;
  }

  async verifyChallenge(
    walletAddress: string,
    signature: string,
  ): Promise<WalletSession> {
    const wallet = normalizeWallet(walletAddress);
    const { data: nonce, error: readError } = await this.database
      .from("auth_nonces")
      .select("wallet_address, nonce_hash, message, expires_at")
      .eq("wallet_address", wallet)
      .maybeSingle();
    if (readError) throw new Error(`Unable to read wallet challenge: ${readError.message}`);
    if (!nonce || new Date(nonce.expires_at).getTime() <= Date.now()) {
      throw new Error("Wallet challenge is missing or expired");
    }

    let recovered: string;
    try {
      recovered = normalizeWallet(verifyMessage(nonce.message, signature));
    } catch {
      throw new Error("Wallet signature is invalid");
    }
    if (recovered !== wallet) throw new Error("Wallet signature does not match wallet");

    const { data: consumed, error: consumeError } = await this.database
      .from("auth_nonces")
      .delete()
      .eq("wallet_address", wallet)
      .eq("nonce_hash", nonce.nonce_hash)
      .select("wallet_address");
    if (consumeError) throw new Error(`Unable to consume wallet challenge: ${consumeError.message}`);
    if (!consumed?.length) throw new Error("Wallet challenge was already consumed");

    const roles = await this.getRoles(wallet);
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
    const payload = encode(JSON.stringify({
      walletAddress: wallet,
      roles,
      expiresAt,
    }));
    const signaturePart = createHmac("sha256", this.sessionSecret)
      .update(payload)
      .digest("base64url");
    return { token: `${payload}.${signaturePart}`, walletAddress: wallet, roles, expiresAt };
  }

  async getRoles(walletAddress: string): Promise<ApplicationRole[]> {
    const wallet = normalizeWallet(walletAddress);
    const { data, error } = await this.database
      .from("user_roles")
      .select("role")
      .eq("wallet_address", wallet);
    if (error) throw new Error(`Unable to read wallet roles: ${error.message}`);
    return data.map((entry) => entry.role);
  }

  verifySession(token: string): Omit<WalletSession, "token"> {
    const [payload, providedSignature] = token.split(".");
    if (!payload || !providedSignature) throw new Error("Session token is malformed");
    const expectedSignature = createHmac("sha256", this.sessionSecret)
      .update(payload)
      .digest("base64url");
    const providedBytes = Buffer.from(providedSignature);
    const expectedBytes = Buffer.from(expectedSignature);
    if (providedBytes.length !== expectedBytes.length ||
      !timingSafeEqual(providedBytes, expectedBytes)) {
      throw new Error("Session token is invalid");
    }
    let session: Omit<WalletSession, "token">;
    try {
      session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      throw new Error("Session token payload is invalid");
    }
    if (new Date(session.expiresAt).getTime() <= Date.now()) throw new Error("Session token is expired");
    return session;
  }

  async requireRole(session: Omit<WalletSession, "token">, role: ApplicationRole): Promise<void> {
    const roles = await this.getRoles(session.walletAddress);
    if (!roles.includes(role)) throw new Error(`Role ${role} is required`);
  }

  async requireAnyRole(
    session: Omit<WalletSession, "token">,
    requiredRoles: ApplicationRole[],
  ): Promise<void> {
    const roles = await this.getRoles(session.walletAddress);
    if (!requiredRoles.some((role) => roles.includes(role))) {
      throw new Error(`One of these roles is required: ${requiredRoles.join(", ")}`);
    }
  }
}
