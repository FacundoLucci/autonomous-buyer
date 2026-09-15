import { expect, test } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ApprovalPrompt, BuySentence } from "./sentences";
import { buyStatus, type Buy } from "./model";

const pendingBuy = {
  name: "School notebooks",
  unit: "units",
  quantity: 2,
  requiredBy: "2026-10-10",
  order: {
    browserTermsPending: true,
    status: "draft",
    reviewRequired: false,
    quantity: 2,
    supplier: "School supply store",
    unit: "units",
    totalCents: 0,
    currency: "USD",
    expectedOn: "2026-10-08",
    quotedArrival: "2026-10-08",
  },
} as Buy;

test("unpriced website buy hides placeholder amount and arrival even if other flags look ready", () => {
  const html = renderToStaticMarkup(
    <>
      <BuySentence buy={pendingBuy} />
      <ApprovalPrompt buy={pendingBuy} busy={false} onYes={() => {}} onNo={() => {}} />
    </>,
  );
  expect(html).toContain("Checking checkout total and delivery");
  expect(html).toContain("School notebooks");
  expect(html).toContain("Oct 10");
  expect(html).not.toContain("$0");
  expect(html).not.toContain("Oct 8");
  expect(html).not.toContain("expected by");
  expect(html).not.toContain("Approve and order");
  expect(html).not.toContain("<button");
  expect(buyStatus(pendingBuy)).toBe("Checking checkout total");
});
