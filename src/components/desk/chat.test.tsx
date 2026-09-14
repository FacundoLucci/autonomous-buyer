import { getFunctionName } from "convex/server";
import { beforeEach, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskChat } from "./chat";
const state = vi.hoisted(() => ({ conversation: null as any, suggestion: null as any }));
vi.mock("convex/react", () => ({
  useQuery: (ref: Parameters<typeof getFunctionName>[0]) =>
    getFunctionName(ref).startsWith("companySuggestion:") ? state.suggestion : state.conversation,
  useMutation: () => vi.fn(),
}));
vi.mock("@/lib/buyer-auth", () => ({ useAuthActions: () => ({ token: null }) }));
beforeEach(() => {
  state.conversation = null;
  state.suggestion = null;
});
test("setup shows the company column before any details have been discovered", () => {
  const html = renderToStaticMarkup(
    <TaskChat request={{ task: "onboarding" }} onSaved={() => {}} />,
  );
  expect(html).toContain('aria-label="Draft"');
  expect(html).toContain("Company details");
  expect(html).toContain("Your company name and delivery address will appear here.");
});
test("resumed setup keeps manual recovery beside the conversation", () => {
  state.conversation = {
    _id: "setup",
    draft: {},
    messages: [{ id: "message", role: "user", text: "LUHV FOOD" }],
    busy: false,
  };
  const html = renderToStaticMarkup(
    <TaskChat request={{ task: "onboarding" }} onSaved={() => {}} />,
  );
  const aside = html.slice(html.indexOf("<aside"));
  expect(aside).toContain("Enter company details yourself");
  expect(aside).toContain('name="companyName"');
  expect(aside).toContain('name="shippingAddress"');
});

test("researched company is presented for confirmation rather than ready to save", () => {
  state.suggestion = {
    _id: "suggestion",
    status: "ready",
    companyName: "LUHV FOOD",
    shippingAddress: "123 Test Street, Philadelphia PA 19103, USA",
    sourceUrl: "https://luhvfood.com",
  };
  const html = renderToStaticMarkup(
    <TaskChat request={{ task: "onboarding" }} onSaved={() => {}} />,
  );
  expect(html).toContain("Is this your company and delivery address?");
  expect(html).toContain("LUHV FOOD");
  expect(html).toContain("Yes, use these");
  expect(html).not.toContain("Join the list");
});
