import { createContext, useContext, useState, type ReactNode } from "react";
import {
  ConvexAuthProvider as PasskeyProvider,
  useAuthActions as usePasskeyActions,
  useAuthToken as usePasskeyToken,
} from "@convex-dev/auth2/react";
import {
  ConvexAuthProvider as LegacyProvider,
  useAuthActions as useLegacyActions,
  useAuthToken as useLegacyToken,
} from "@convex-dev/auth/react";
import { useMutation, type ConvexReactClient } from "convex/react";
import { api } from "../../convex/_generated/api";
export { useConvexAuth } from "convex/react";

type Actions = {
  token: string | null;
  version: "passkey" | "password";
  signOut: () => Promise<void>;
  signIn: (provider: string, params?: Record<string, string>) => Promise<unknown>;
};
const AuthContext = createContext<Actions | null>(null);
export function useAuthActions() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("Missing Buyer auth provider.");
  return value;
}
function initialVersion(): Actions["version"] {
  if (typeof window === "undefined") return "passkey";
  const params = new URLSearchParams(window.location.search);
  const selected = params.get("method");
  if (selected === "password" || selected === "passkey") {
    try {
      localStorage.setItem("buy-hard-auth-method", selected);
    } catch {
      /* Optional preference. */
    }
    return selected;
  }
  try {
    return localStorage.getItem("buy-hard-auth-method") === "password" ? "password" : "passkey";
  } catch {
    return "passkey";
  }
}
export function BuyerAuthProvider({
  client,
  children,
}: {
  client: ConvexReactClient;
  children: ReactNode;
}) {
  const [version] = useState(initialVersion);
  return version === "password" ? (
    <LegacyProvider client={client}>
      <LegacyActions>{children}</LegacyActions>
    </LegacyProvider>
  ) : (
    <PasskeyProvider
      client={client}
      storageNamespace={`buy-hard-passkeys-${import.meta.env.VITE_CONVEX_URL}`}
      api={{ refreshSession: api.passkeyAuth.refreshSession, signOut: api.passkeyAuth.signOut }}
    >
      <PasskeyActions>{children}</PasskeyActions>
    </PasskeyProvider>
  );
}
function LegacyActions({ children }: { children: ReactNode }) {
  const actions = useLegacyActions();
  const token = useLegacyToken();
  return (
    <AuthContext.Provider value={{ ...actions, token, version: "password" }}>
      {children}
    </AuthContext.Provider>
  );
}
function PasskeyActions({ children }: { children: ReactNode }) {
  const { setSession, signOut } = usePasskeyActions();
  const token = usePasskeyToken();
  const anonymous = useMutation(api.passkeyAuth.signInAnonymous);
  async function signIn(provider: string) {
    if (provider !== "anonymous")
      throw new Error("Use the password sign-in link for an existing password account.");
    const result = await anonymous({});
    await setSession(result.tokens);
    return result;
  }
  return (
    <AuthContext.Provider value={{ version: "passkey", signOut, signIn, token }}>
      {children}
    </AuthContext.Provider>
  );
}
