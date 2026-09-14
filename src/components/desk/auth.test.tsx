import { beforeEach, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { getFunctionName } from "convex/server";
import { AccountPage } from "./auth";
import { Landing } from "./landing";

const state = vi.hoisted(() => ({
  authenticated: false,
  user: null as null | {
    name: string;
    email: string;
    isJudgeDemo: boolean;
    canApproveDemo: boolean;
  },
  workspace: null as null | { companyName: string },
}));
vi.mock("@/lib/buyer-auth", () => ({
  useConvexAuth: () => ({ isAuthenticated: state.authenticated, isLoading: false }),
  useAuthActions: () => ({ version: "password", signIn: vi.fn(), signOut: vi.fn() }),
}));
vi.mock("convex/react", () => ({
  useMutation: () => vi.fn(),
  useQuery: (reference: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(reference).startsWith("authData:") ? state.user : state.workspace,
}));
vi.mock("@tanstack/react-router", () => ({ Navigate: () => <span>Open workspace</span> }));
vi.mock("./chat", () => ({ TaskChat: () => <span>Resume saved setup</span> }));
vi.mock("./primitives", () => ({
  Brand: () => <a href="/">Home</a>,
  Loading: () => <span>Loading</span>,
}));
beforeEach(() => {
  state.authenticated = false;
  state.user = null;
  state.workspace = null;
});
test("signup and login offer their own form and a link to the other mode", () => {
  const signup = renderToStaticMarkup(<AccountPage mode="signup" />);
  expect(signup).toContain("Create your account.");
  expect(signup).toContain("/setup?mode=login&amp;method=password");
  expect(signup).toContain('autoComplete="new-password"');
  const login = renderToStaticMarkup(<AccountPage mode="login" />);
  expect(login).toContain("/setup?mode=signup&amp;method=password");
  expect(login).toContain('autoComplete="current-password"');
});
test("a demo session does not replace account forms with a sign-out dead end", () => {
  state.authenticated = true;
  state.user = { name: "Demo", email: "", isJudgeDemo: true, canApproveDemo: true };
  for (const mode of ["signup", "login"] as const) {
    const html = renderToStaticMarkup(<AccountPage mode={mode} />);
    expect(html).toContain('type="password"');
    expect(html).not.toContain("Sign out of the demo");
    expect(html).not.toContain("Resume saved setup");
  }
});
test("an unfinished real account resumes setup with exit and account-switch controls", () => {
  state.authenticated = true;
  state.user = {
    name: "Buyer",
    email: "buyer@example.test",
    isJudgeDemo: false,
    canApproveDemo: false,
  };
  const html = renderToStaticMarkup(<AccountPage mode="login" />);
  expect(html).toContain("Resume saved setup");
  expect(html).toContain('href="/">Finish later');
  expect(html).toContain("Use another account");
  const home = renderToStaticMarkup(<Landing resumeSetup />);
  expect(home).toContain("Continue setup");
  expect(home).not.toContain("Resume saved setup");
});
test("an account with a company opens its workspace from either account entry", () => {
  state.authenticated = true;
  state.workspace = { companyName: "Buyer company" };
  expect(renderToStaticMarkup(<AccountPage mode="signup" />)).toContain("Open workspace");
  expect(renderToStaticMarkup(<AccountPage mode="login" />)).toContain("Open workspace");
});
