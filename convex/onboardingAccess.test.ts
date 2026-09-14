/// <reference types="vite/client" />
import { afterEach, expect, test, vi } from "vitest";
import { convexTest } from "convex-test";
import schema from "./schema";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const modules = import.meta.glob("./**/*.ts");
afterEach(() => vi.unstubAllEnvs());

async function fixture() {
  const t = convexTest(schema, modules);
  const ids = await t.run(async (ctx) => {
    const applicant = await ctx.db.insert("users", {
      email: "applicant@example.test",
      isActive: true,
      role: "viewer",
    });
    const owner = await ctx.db.insert("users", {
      email: "owner@example.test",
      isActive: true,
      role: "admin",
    });
    const outsider = await ctx.db.insert("users", {
      email: "owner@example.test",
      isActive: true,
      role: "admin",
    });
    const demo = await ctx.db.insert("users", {
      isAnonymous: true,
      isActive: true,
      role: "viewer",
    });
    const chatId = await ctx.db.insert("taskChats", {
      userId: applicant,
      task: "onboarding",
      threadId: "invitation-test",
      draft: {
        companyName: "River Street Bakery",
        shippingAddress: "100 River St, Chicago IL 60601, US",
      },
      busy: false,
      updatedAt: Date.now(),
    });
    return { applicant, owner, outsider, demo, chatId };
  });
  vi.stubEnv("MARKETING_OWNER_USER_ID", ids.owner);
  const applicant = t.withIdentity({ subject: ids.applicant });
  const owner = t.withIdentity({ subject: ids.owner });
  const outsider = t.withIdentity({ subject: ids.outsider });
  const demo = t.withIdentity({ subject: ids.demo });
  const submit = () =>
    applicant.mutation(api.desk.commit, { chatId: ids.chatId, timezone: "America/Chicago" });
  return { t, ids, applicant, owner, outsider, demo, submit };
}

test("saving setup creates one private, persistent request and no live resources", async () => {
  const { t, ids, applicant, owner, outsider, demo, submit } = await fixture();
  const requestId = await submit();
  expect(await submit()).toBe(requestId);
  const returning = t.withIdentity({ subject: ids.applicant });
  expect(await returning.query(api.onboardingAccess.current, {})).toMatchObject({
    companyName: "River Street Bakery",
  });
  for (const actor of [t, outsider, demo]) {
    expect(await actor.query(api.onboardingAccess.current, {})).toBeNull();
    await expect(
      actor.query(api.onboardingAccess.ownerList, {
        paginationOpts: { numItems: 25, cursor: null },
      }),
    ).rejects.toThrow(/Only Facundo/);
  }
  await t.run(async (ctx) => {
    expect(await ctx.db.query("onboardingRequests").take(5)).toHaveLength(1);
    for (const table of [
      "organizations",
      "inventoryItems",
      "purchasingInboxes",
      "companyOrders",
    ] as const)
      expect(await ctx.db.query(table).take(5)).toEqual([]);
    expect((await ctx.db.get("users", ids.applicant))?.role).toBe("viewer");
  });
  expect(await applicant.query(api.onboarding.getWorkspace, {})).toBeNull();
  await expect(applicant.query(api.desk.snapshot, {})).rejects.toThrow(/Set up your company/);
  const list = await owner.query(api.onboardingAccess.ownerList, {
    paginationOpts: { numItems: 25, cursor: null },
  });
  expect(list.page[0]).toMatchObject({ _id: requestId, email: "applicant@example.test" });
});

test("legacy setup endpoints cannot bypass an invitation before or after submission", async () => {
  const { t, applicant, submit } = await fixture();
  const setup = {
    companyName: "Another name",
    shippingAddress: "100 River St, Chicago IL 60601, US",
    timezone: "America/Chicago",
    itemName: "Paper cups",
    quantity: "10",
    dailyUsage: "2",
    unit: "units" as const,
  };
  for (const saved of [false, true]) {
    if (saved) await submit();
    await expect(applicant.mutation(api.onboarding.completeFromSource, setup)).rejects.toThrow(
      /invite only/,
    );
    await expect(
      applicant.mutation(api.onboarding.complete, {
        ...setup,
        sku: "CUPS",
        leadTimeDays: "2",
        safetyStockDays: "3",
      }),
    ).rejects.toThrow(/invite only/);
    await expect(
      applicant.mutation(api.companyInventory.addItem, {
        name: "Cups",
        sku: "CUPS",
        unit: "units",
        buyUrl: "",
        supplier: "",
      }),
    ).rejects.toThrow(/Set up your company/);
    expect(await applicant.query(api.onboarding.getWorkspace, {})).toBeNull();
  }
  await t.run(async (ctx) => {
    expect(await ctx.db.query("organizations").take(5)).toEqual([]);
  });
});

test("only the exact owner can grant access, and repeated grants create one workspace", async () => {
  const { t, ids, applicant, owner, outsider, demo, submit } = await fixture();
  const requestId = (await submit()) as Id<"onboardingRequests">;
  for (const actor of [t, applicant, outsider, demo])
    await expect(actor.mutation(api.onboardingAccess.grant, { requestId })).rejects.toThrow(
      /Only Facundo/,
    );
  const organizationId = await owner.mutation(api.onboardingAccess.grant, { requestId });
  expect(await owner.mutation(api.onboardingAccess.grant, { requestId })).toBe(organizationId);
  expect(await applicant.query(api.onboardingAccess.current, {})).toBeNull();
  expect(await applicant.query(api.onboarding.getWorkspace, {})).toMatchObject({
    organizationId,
    companyName: "River Street Bakery",
    items: [],
    inbox: null,
  });
  await t.run(async (ctx) => {
    expect(await ctx.db.query("organizations").take(5)).toHaveLength(1);
    expect(await ctx.db.get("onboardingRequests", requestId)).toMatchObject({
      approvedBy: ids.owner,
      organizationId,
    });
    expect((await ctx.db.get("users", ids.applicant))?.workspaceAccessGrantedAt).toBeTypeOf(
      "number",
    );
  });
});

test("invalid details, inactive users, and another user's saved conversation cannot create a request", async () => {
  const { t, ids, outsider, applicant, submit } = await fixture();
  await expect(
    outsider.mutation(api.desk.commit, { chatId: ids.chatId, timezone: "America/Chicago" }),
  ).rejects.toThrow(/Conversation not found/);
  await expect(
    applicant.mutation(api.desk.commit, { chatId: ids.chatId, timezone: "invalid" }),
  ).rejects.toThrow(/timezone/);
  await t.run((ctx) =>
    ctx.db.patch("taskChats", ids.chatId, {
      draft: { companyName: "Bakery", shippingAddress: "Short" },
    }),
  );
  await expect(submit()).rejects.toThrow(/full delivery address/);
  await t.run((ctx) => ctx.db.patch("users", ids.applicant, { isActive: false }));
  await expect(submit()).rejects.toThrow(/Sign in/);
  await t.run(async (ctx) => {
    expect(await ctx.db.query("onboardingRequests").take(5)).toEqual([]);
  });
});
