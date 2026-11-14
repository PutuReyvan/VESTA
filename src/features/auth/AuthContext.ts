import type { Session, User } from "@supabase/supabase-js";
import type { ApplicationRole } from "../../offchain/types";
import { createContext } from "react";

export type IdentityInitializationStatus = "idle" | "loading" | "ready" | "error";
export type AuthAccessState = "loading" | "login" | "identity-error" | "no-role" | "authorized";

export function getAuthAccessState(input: {
  loading: boolean;
  authenticated: boolean;
  identityStatus: IdentityInitializationStatus;
  roleCount: number;
}): AuthAccessState {
  if (input.loading) return "loading";
  if (!input.authenticated) return "login";
  if (input.identityStatus === "error") return "identity-error";
  if (input.identityStatus !== "ready") return "loading";
  if (input.roleCount === 0) return "no-role";
  return "authorized";
}

export interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  error: string | null;
  identityStatus: IdentityInitializationStatus;
  identityError: string | null;
  session: Session | null;
  user: User | null;
  roles: ApplicationRole[];
  hasRole: (role: ApplicationRole) => boolean;
  retryIdentityInitialization: () => Promise<void>;
  signInWithWallet: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
