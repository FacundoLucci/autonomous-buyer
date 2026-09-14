import { test, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AccountPage } from "./auth";
vi.mock("@/lib/buyer-auth", () => ({
  useConvexAuth: () => ({ isAuthenticated: false, isLoading: false }),
  useAuthActions: () => ({ version: "passkey", signOut: vi.fn() }),
}));
vi.mock("@convex-dev/auth2/providers/passkey/react", () => ({
  usePasskey: () => ({ signIn: vi.fn(), pending: false }),
}));
vi.mock("convex/react", () => ({ useQuery: () => null, useMutation: () => vi.fn() }));
vi.mock("@tanstack/react-router", () => ({ Navigate: () => null }));
test("passkey signup and sign-in both ask for email", () => {
  for (const mode of ["signup", "login"] as const) {
    const html = renderToStaticMarkup(<AccountPage mode={mode} />);
    expect(html).toContain('type="email"');
    expect(html).toContain("Email");
    expect(html).not.toContain("Account name");
    expect(html).toContain('autoComplete="username webauthn"');
  }
});
