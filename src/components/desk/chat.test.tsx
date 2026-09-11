import { beforeEach, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TaskChat } from "./chat";
const state = vi.hoisted(() => ({ conversation: null as any }));
vi.mock("convex/react", () => ({ useQuery: () => state.conversation, useMutation: () => vi.fn() }));
vi.mock("@/lib/buyer-auth", () => ({ useAuthActions: () => ({ token: null }) }));
beforeEach(() => {
  state.conversation = null;
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
