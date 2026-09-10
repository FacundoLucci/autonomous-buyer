/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api, internal } from "./_generated/api";
import { supplierAllowed } from "./companySuppliers";
import {
  emailOrderingEvidence,
  emailEvidenceInContext,
  supplierWebsite,
} from "./supplierDirectoryFields";
const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.useRealTimers());
async function fixture() {
  vi.useFakeTimers();
  const t = convexTest(schema, modules);
  const modulePath: string = "@convex-dev/rate-limiter/test";
  const limiter: { default: { register: (instance: typeof t) => void } } = await import(modulePath);
  limiter.default.register(t);
  const ids = await t.run(async (ctx) => {
    const ids = [];
    for (const name of ["A", "B"]) {
      const organizationId = await ctx.db.insert("organizations", {
        name,
        timezone: "UTC",
        isDemo: false,
        approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 2 },
      });
      ids.push(
        await ctx.db.insert("users", { name, organizationId, role: "admin", isActive: true }),
      );
    }
    return ids;
  });
  return { t, a: t.withIdentity({ subject: ids[0] }), b: t.withIdentity({ subject: ids[1] }) };
}
test("directory isolates companies and deduplicates website variants without reallowing paused suppliers", async () => {
  const { t, a, b } = await fixture();
  const id = await a.mutation(api.companySuppliers.add, {
    url: "https://www.amazon.com/item?tracking=x",
    name: "Amazon",
  });
  expect(await a.mutation(api.companySuppliers.add, { url: "amazon.com/other" })).toBe(id);
  expect(await b.query(api.companySuppliers.list, {})).toEqual([]);
  await expect(
    b.mutation(api.companySuppliers.update, { supplierId: id, approved: false }),
  ).rejects.toThrow("Supplier not found");
  await a.mutation(api.companySuppliers.update, {
    supplierId: id,
    approved: false,
    notes: "Use business account",
  });
  expect(await a.mutation(api.companySuppliers.add, { url: "amazon.com" })).toBe(id);
  const row = (await a.query(api.companySuppliers.list, {}))[0];
  expect(row).toMatchObject({ approved: false, channels: "unknown", readiness: "unverified" });
  expect(
    await t.run((ctx) => supplierAllowed(ctx, row.organizationId, "https://www.amazon.com/p")),
  ).toBe(false);
  await expect(t.query(api.companySuppliers.list, {})).rejects.toThrow();
});
test("stale assessment cannot overwrite current findings or company approval and notes", async () => {
  const { t, a } = await fixture();
  const supplierId = await a.mutation(api.companySuppliers.add, {
    url: "supplier.example",
    notes: "My requirements",
  });
  await t.mutation(internal.companySuppliers.begin, { supplierId, version: 1 });
  await a.mutation(api.companySuppliers.reassess, { supplierId });
  expect(
    await t.mutation(internal.companySuppliers.finish, {
      supplierId,
      version: 1,
      browser: { url: "https://supplier.example", excerpt: "Add to cart" },
      note: "Old",
    }),
  ).toBe(false);
  await t.mutation(internal.companySuppliers.begin, { supplierId, version: 2 });
  await a.mutation(api.companySuppliers.update, { supplierId, approved: false });
  await t.mutation(internal.companySuppliers.finish, {
    supplierId,
    version: 2,
    browser: { url: "https://supplier.example", excerpt: "Add to cart" },
    emailEvidence: {
      url: "https://supplier.example/orders",
      excerpt: "Send purchase orders by email to orders@supplier.example.",
    },
    email: "orders@supplier.example",
    note: "Requires account; checkout has not been tested.",
  });
  expect((await a.query(api.companySuppliers.list, {}))[0]).toMatchObject({
    channels: "both",
    readiness: "needs_setup",
    approved: false,
    notes: "My requirements",
    assessmentState: "complete",
  });
  await a.mutation(api.companySuppliers.reassess, { supplierId });
  await t.mutation(internal.companySuppliers.expire, { supplierId, version: 3 });
  expect((await a.query(api.companySuppliers.list, {}))[0]).toMatchObject({
    channels: "unknown",
    readiness: "unverified",
    assessmentState: "needs_help",
  });
});
test("email evidence cannot omit surrounding negation", () => {
  expect(
    emailEvidenceInContext(
      "Do not send purchase orders by email orders@shop.example",
      "send purchase orders by email orders@shop.example",
      "orders@shop.example",
    ),
  ).toBe(false);
});
test("contact email and misleading PO fragments do not establish email ordering", () => {
  expect(
    emailOrderingEvidence("Contact support by email orders@shop.example", "orders@shop.example"),
  ).toBe(false);
  expect(
    emailOrderingEvidence(
      "We do not accept purchase orders by email orders@shop.example",
      "orders@shop.example",
    ),
  ).toBe(false);
  expect(
    emailOrderingEvidence(
      "Send purchase orders by email xorders@shop.example",
      "orders@shop.example",
    ),
  ).toBe(false);
  expect(
    emailOrderingEvidence(
      "Send purchase orders by email orders@shop.example",
      "orders@shop.example",
    ),
  ).toBe(true);
  for (const url of [
    "http://shop.example",
    "https://localhost",
    "https://127.0.0.1",
    "https://user:pass@shop.example",
  ])
    expect(() => supplierWebsite(url)).toThrow();
});
test("cross-domain evidence cannot claim an ordering method", async () => {
  const { t, a } = await fixture();
  const supplierId = await a.mutation(api.companySuppliers.add, { url: "shop.example" });
  await t.mutation(internal.companySuppliers.begin, { supplierId, version: 1 });
  await t.mutation(internal.companySuppliers.finish, {
    supplierId,
    version: 1,
    browser: { url: "https://other.example", excerpt: "Add to cart" },
    note: "Unknown",
  });
  expect((await a.query(api.companySuppliers.list, {}))[0]).toMatchObject({
    channels: "unknown",
    assessmentState: "needs_help",
    readiness: "unverified",
  });
});
