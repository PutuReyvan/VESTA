import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from "react";
import type { Session } from "@supabase/supabase-js";
import type { ApplicationRole } from "../../offchain/types";
import {
  AuthContext,
  type AuthContextValue,
  type IdentityInitializationStatus,
} from "./AuthContext";
import { supabase } from "./supabase";

const SEPOLIA_CHAIN_ID = 11155111;
const SEPOLIA_CHAIN_HEX = "0xaa36a7";

type EthereumProvider = {
  request(args: { method: string; params?: readonly unknown[] }): Promise<unknown>;
};

let activeWalletSignIn: Promise<void> | null = null;

function getEthereumProvider(): EthereumProvider | null {
  const provider = (window as Window & { ethereum?: EthereumProvider }).ethereum;
  return provider && typeof provider.request === "function" ? provider : null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<ApplicationRole[]>([]);
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState<string | null>(
    supabase ? null : "Supabase Web3 Auth is not configured.",
  );
  const [identityStatus, setIdentityStatus] = useState<IdentityInitializationStatus>("idle");
  const [identityError, setIdentityError] = useState<string | null>(null);
  const roleLoadVersion = useRef(0);

  const loadRoles = useCallback(async (userId: string | null) => {
    const requestVersion = ++roleLoadVersion.current;
    setRoles([]);
    setIdentityError(null);
    if (!supabase || !userId) {
      setIdentityStatus("idle");
      return;
    }

    setError(null);
    setIdentityStatus("loading");
    try {
      const { data: verifiedWallet, error: walletIdentityError } = await supabase.rpc("ensure_wallet_identity");
      if (requestVersion !== roleLoadVersion.current) return;
      if (walletIdentityError) throw new Error(walletIdentityError.message);
      if (typeof verifiedWallet !== "string") {
        throw new Error("Wallet identity verification returned an invalid response.");
      }

      const provider = getEthereumProvider();
      const accounts = provider
        ? await provider.request({ method: "eth_accounts" })
        : [];
      if (requestVersion !== roleLoadVersion.current) return;
      const activeWallet = Array.isArray(accounts) && typeof accounts[0] === "string"
        ? accounts[0]
        : null;
      if (!activeWallet || activeWallet.toLowerCase() !== verifiedWallet.toLowerCase()) {
        setSession(null);
        setRoles([]);
        setIdentityStatus("idle");
        setIdentityError(null);
        setError("The connected wallet does not match this session. Sign in again.");
        void supabase.auth.signOut();
        return;
      }

      const { error: defaultRoleError } = await supabase.rpc("ensure_default_employee_role");
      if (requestVersion !== roleLoadVersion.current) return;
      if (defaultRoleError) throw new Error(defaultRoleError.message);

      const { data, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (requestVersion !== roleLoadVersion.current) return;
      if (roleError) throw new Error(roleError.message);

      setRoles((data ?? []).map((entry) => entry.role as ApplicationRole));
      setIdentityStatus("ready");
      setIdentityError(null);
    } catch (loadError) {
      if (requestVersion !== roleLoadVersion.current) return;
      setRoles([]);
      setIdentityStatus("error");
      setIdentityError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to verify wallet identity and roles.",
      );
    }
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    void supabase.auth.getSession()
      .then(({ data, error: sessionError }) => {
        if (!active) return;
        if (sessionError) {
          setError(sessionError.message);
          setSession(null);
          setRoles([]);
          setIdentityStatus("idle");
          setIdentityError(null);
          return;
        }
        setSession(data.session);
        void loadRoles(data.session?.user.id ?? null);
      })
      .catch((sessionLoadError: unknown) => {
        if (!active) return;
        setError(
          sessionLoadError instanceof Error
            ? sessionLoadError.message
            : "Unable to load the authentication session.",
        );
        setSession(null);
        setRoles([]);
        setIdentityStatus("idle");
        setIdentityError(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      roleLoadVersion.current += 1;
      setSession(nextSession);
      setRoles([]);
      setIdentityError(null);
      setIdentityStatus(nextSession ? "loading" : "idle");
      if (nextSession) setError(null);
      setTimeout(() => {
        if (active) void loadRoles(nextSession?.user.id ?? null);
      }, 0);
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [loadRoles]);

  const retryIdentityInitialization = useCallback(async () => {
    await loadRoles(session?.user.id ?? null);
  }, [loadRoles, session?.user.id]);

  const signInWithWallet = useCallback(() => {
    if (activeWalletSignIn) return activeWalletSignIn;

    activeWalletSignIn = (async () => {
      if (!supabase) throw new Error("Supabase Web3 Auth is not configured.");

      const provider = getEthereumProvider();
      if (!provider) {
        throw new Error("No compatible Ethereum wallet was detected in this browser.");
      }

      setError(null);

      const chainId = await provider.request({ method: "eth_chainId" });
      if (chainId !== SEPOLIA_CHAIN_HEX) {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: SEPOLIA_CHAIN_HEX }],
        });
      }

      // Supabase signInWithWeb3 performs the single eth_requestAccounts call
      // internally. Do not call WalletProvider.connect() before this method;
      // doing so creates two concurrent MetaMask permission requests.
      const { error: signInError } = await supabase.auth.signInWithWeb3({
        chain: "ethereum",
        statement: "Sign in to VESTA to access vesting data.",
        options: { signInWithEthereum: { chainId: SEPOLIA_CHAIN_ID } },
      });
      if (signInError) {
        setError(signInError.message);
        throw signInError;
      }

      // signInWithWeb3 already requested the account. Share it with the
      // wallet context without triggering a second MetaMask permission prompt.
      const accounts = await provider.request({ method: "eth_accounts" });
      const account = Array.isArray(accounts) && typeof accounts[0] === "string"
        ? accounts[0]
        : null;
      if (account) {
        window.dispatchEvent(
          new CustomEvent("vesta:wallet-authenticated", { detail: { account } }),
        );
      }
    })().finally(() => {
      activeWalletSignIn = null;
    });

    return activeWalletSignIn;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setError(null);
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) {
      setError(signOutError.message);
      throw signOutError;
    }
    roleLoadVersion.current += 1;
    setSession(null);
    setRoles([]);
    setIdentityStatus("idle");
    setIdentityError(null);
  }, []);

  useEffect(() => {
    const handleWalletAccountChanged = () => {
      roleLoadVersion.current += 1;
      if (session) {
        // Clear the local identity before the async Supabase sign-out finishes.
        // Otherwise the previous wallet can briefly retain authenticated UI and
        // role-gated actions while the new account is already selected.
        setSession(null);
        setRoles([]);
        setIdentityStatus("idle");
        setIdentityError(null);
        void signOut();
      }
    };

    window.addEventListener("vesta:wallet-account-changed", handleWalletAccountChanged);
    return () => window.removeEventListener("vesta:wallet-account-changed", handleWalletAccountChanged);
  }, [session, signOut]);

  const value = useMemo<AuthContextValue>(
    () => ({
      configured: Boolean(supabase),
      loading,
      error,
      identityStatus,
      identityError,
      session,
      user: session?.user ?? null,
      roles,
      hasRole: (role) => roles.includes(role),
      retryIdentityInitialization,
      signInWithWallet,
      signOut,
    }),
    [
      error,
      identityError,
      identityStatus,
      loading,
      retryIdentityInitialization,
      roles,
      session,
      signInWithWallet,
      signOut,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
