import type { Session, User } from "@supabase/supabase-js";
import type { ApplicationRole } from "../../offchain/types";
import { createContext } from "react";

export interface AuthContextValue {
  configured: boolean;
  loading: boolean;
  error: string | null;
  session: Session | null;
  user: User | null;
  roles: ApplicationRole[];
  hasRole: (role: ApplicationRole) => boolean;
  signInWithWallet: () => Promise<void>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
