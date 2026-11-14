import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session } from "@supabase/supabase-js";
import type { ApplicationRole } from "../../offchain/types";
import { AuthContext, type AuthContextValue } from "./AuthContext";
import { supabase } from "./supabase";

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<ApplicationRole[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(
    supabase ? null : "Supabase Web3 Auth is not configured.",
  );

  const loadRoles = useCallback(async (userId: string | null) => {
    if (!supabase || !userId) {
      setRoles([]);
      return;
    }

    const { data, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (roleError) {
      setError(roleError.message);
      setRoles([]);
      return;
    }
    setRoles(data.map((entry) => entry.role as ApplicationRole));
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    void supabase.auth.getSession().then(({ data, error: sessionError }) => {
      if (!active) return;
      if (sessionError) setError(sessionError.message);
      setSession(data.session);
      void loadRoles(data.session?.user.id ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setError(null);
      setTimeout(() => {
        if (active) void loadRoles(nextSession?.user.id ?? null);
      }, 0);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [loadRoles]);

  const signInWithWallet = useCallback(async () => {
    if (!supabase) throw new Error("Supabase Web3 Auth is not configured.");
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithWeb3({
      chain: "ethereum",
      statement: "Sign in to VESTA to access vesting data.",
    });
    if (signInError) {
      setError(signInError.message);
      throw signInError;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }
    setSession(null);
    setRoles([]);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: Boolean(supabase),
      loading,
      error,
      session,
      user: session?.user ?? null,
      roles,
      hasRole: (role) => roles.includes(role),
      signInWithWallet,
      signOut,
    }),
    [error, loading, roles, session, signInWithWallet, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
