import { expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MerchantMetricsView } from "./merchant-metrics";
vi.mock("./dot-matrix-display", () => ({
  DotMatrixDisplay: ({ value }: { value: string }) => <span>{value}</span>,
}));
test("merchant section stays hidden until a confirmed order exists", () => {
  expect(
    renderToStaticMarkup(
      <MerchantMetricsView summary={{ totalOrders: 0, merchantCount: 0, merchants: [] }} />,
    ),
  ).toBe("");
  expect(renderToStaticMarkup(<MerchantMetricsView />)).toBe("");
  expect(renderToStaticMarkup(<MerchantMetricsView unavailable />)).toBe("");
  expect(
    renderToStaticMarkup(
      <MerchantMetricsView
        summary={{
          totalOrders: 1,
          merchantCount: 1,
          merchants: [{ name: "Supplier", domain: "supplier.test", orders: 1 }],
        }}
      />,
    ),
  ).toContain("Where we’ve bought.");
});
