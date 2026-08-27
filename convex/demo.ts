import { v } from "convex/values";

import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import {
  coverageDemand,
  projectedStockoutDate,
  roundOrderQuantity,
  trailing30DayAverageUsage,
} from "./domain/inventory";

const DAY_MS = 86_400_000;
const SCENARIO_VERSION = "bc-04-v1";
const RISK_CALCULATION_VERSION = "inventory-risk-v1";

const scenarioValidator = v.object({
  demoRunId: v.id("demoRuns"),
  status: v.union(
    v.literal("ready"),
    v.literal("active"),
    v.literal("completed"),
    v.literal("failed"),
    v.literal("reset"),
  ),
  scenarioVersion: v.string(),
  inventory: v.array(
    v.object({
      sku: v.string(),
      name: v.string(),
      quantityOnHand: v.number(),
      averageDailyUsage: v.number(),
      safetyStockDays: v.number(),
      casePack: v.number(),
      status: v.string(),
      isDemo: v.boolean(),
    }),
  ),
  usageRecordCount: v.number(),
  purchaseHistoryCount: v.number(),
  controlledIdentityCount: v.number(),
  metricsAreDemo: v.boolean(),
});

function isoDateAtOffset(asOfTimestamp: number, days: number) {
  return new Date(asOfTimestamp + days * DAY_MS).toISOString().slice(0, 10);
}

function usageForSku(sku: string, dayIndex: number) {
  if (sku === "LID-16-TE") {
    const recentPattern = [548, 576, 612, 648, 676];
    const earlierPattern = [522, 559, 585, 603, 641, 618, 574];
    return dayIndex >= 60
      ? recentPattern[(dayIndex - 60) % recentPattern.length]
      : earlierPattern[dayIndex % earlierPattern.length];
  }
  if (sku === "CONTAINER-16") {
    return [356, 381, 402, 389, 417, 372, 345][dayIndex % 7];
  }
  return [58, 63, 67, 61, 70, 55, 52][dayIndex % 7];
}

async function deleteRunData(ctx: MutationCtx, demoRunId: Id<"demoRuns">) {
  const inventoryItems = await ctx.db
    .query("inventoryItems")
    .withIndex("by_demo_run", (q) => q.eq("demoRunId", demoRunId))
    .take(20);
  const procurements = await ctx.db
    .query("procurements")
    .withIndex("by_demo_run", (q) => q.eq("demoRunId", demoRunId))
    .take(500);

  for (const procurement of procurements) {
    const searchRuns = await ctx.db
      .query("searchRuns")
      .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", procurement._id))
      .take(100);
    for (const searchRun of searchRuns) {
      const results = await ctx.db
        .query("searchResults")
        .withIndex("by_search_run", (q) => q.eq("searchRunId", searchRun._id))
        .take(100);
      for (const result of results) await ctx.db.delete("searchResults", result._id);
      await ctx.db.delete("searchRuns", searchRun._id);
    }

    const products = await ctx.db
      .query("supplierProducts")
      .withIndex("by_procurement_and_supplier", (q) => q.eq("procurementId", procurement._id))
      .take(100);
    for (const product of products) {
      const claims = await ctx.db
        .query("supplierProductClaims")
        .withIndex("by_product", (q) => q.eq("supplierProductId", product._id))
        .take(100);
      for (const claim of claims) await ctx.db.delete("supplierProductClaims", claim._id);
      await ctx.db.delete("supplierProducts", product._id);
    }

    const emailLinks = await ctx.db
      .query("emailLinks")
      .withIndex("by_procurement", (q) => q.eq("procurementId", procurement._id))
      .take(100);
    for (const emailLink of emailLinks) {
      const evidence = await ctx.db
        .query("inboundEmailEvidence")
        .withIndex("by_email_link", (q) => q.eq("emailLinkId", emailLink._id))
        .take(20);
      for (const record of evidence) await ctx.db.delete("inboundEmailEvidence", record._id);
      await ctx.db.delete("emailLinks", emailLink._id);
    }

    const followUps = await ctx.db
      .query("rfqFollowUps")
      .withIndex("by_procurement_and_created_at", (q) => q.eq("procurementId", procurement._id))
      .take(100);
    for (const followUp of followUps) await ctx.db.delete("rfqFollowUps", followUp._id);

    for (const table of ["rfqs", "quotes", "approvals", "purchaseOrders"] as const) {
      const records = await ctx.db
        .query(table)
        .withIndex("by_procurement", (q) => q.eq("procurementId", procurement._id))
        .take(100);
      for (const record of records) await ctx.db.delete(table, record._id);
    }

    const recommendations = await ctx.db
      .query("recommendations")
      .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", procurement._id))
      .take(100);
    for (const recommendation of recommendations) {
      const entries = await ctx.db
        .query("recommendationEntries")
        .withIndex("by_recommendation", (q) => q.eq("recommendationId", recommendation._id))
        .take(20);
      for (const entry of entries) await ctx.db.delete("recommendationEntries", entry._id);
      await ctx.db.delete("recommendations", recommendation._id);
    }

    const events = await ctx.db
      .query("procurementEvents")
      .withIndex("by_procurement_and_created", (q) => q.eq("procurementId", procurement._id))
      .take(500);
    for (const event of events) await ctx.db.delete("procurementEvents", event._id);

    const receipts = await ctx.db
      .query("integrationReceipts")
      .withIndex("by_procurement_and_operation_and_status", (q) =>
        q.eq("procurementId", procurement._id),
      )
      .take(200);
    for (const receipt of receipts) await ctx.db.delete("integrationReceipts", receipt._id);

    const aiRuns = await ctx.db
      .query("aiRuns")
      .withIndex("by_procurement_and_task", (q) => q.eq("procurementId", procurement._id))
      .take(200);
    for (const aiRun of aiRuns) await ctx.db.delete("aiRuns", aiRun._id);
    const threadLinks = await ctx.db
      .query("agentThreadLinks")
      .withIndex("by_procurement_and_anchor", (q) => q.eq("procurementId", procurement._id))
      .take(100);
    for (const link of threadLinks) {
      await ctx.runMutation(components.agent.threads.deleteAllForThreadIdAsync, {
        threadId: link.componentThreadId,
      });
      await ctx.db.delete("agentThreadLinks", link._id);
    }
    await ctx.db.delete("procurements", procurement._id);
  }

  const expectedInventory = [];
  for (const item of inventoryItems) {
    const usage = await ctx.db
      .query("inventoryUsage")
      .withIndex("by_item_date", (q) => q.eq("inventoryItemId", item._id))
      .take(100);
    for (const record of usage) await ctx.db.delete("inventoryUsage", record._id);
    const expected = await ctx.db
      .query("expectedInventory")
      .withIndex("by_item_arrival", (q) => q.eq("inventoryItemId", item._id))
      .take(100);
    expectedInventory.push(...expected);
  }
  for (const record of expectedInventory) await ctx.db.delete("expectedInventory", record._id);

  const runTables = ["demoSupplierIdentities", "purchaseHistory", "historicalMetrics"] as const;
  for (const table of runTables) {
    const records = await ctx.db
      .query(table)
      .withIndex("by_demo_run", (q) => q.eq("demoRunId", demoRunId))
      .take(500);
    for (const record of records) await ctx.db.delete(table, record._id);
  }

  const suppliers = await ctx.db
    .query("suppliers")
    .withIndex("by_demo_run", (q) => q.eq("demoRunId", demoRunId))
    .take(100);
  for (const supplier of suppliers) await ctx.db.delete("suppliers", supplier._id);
  for (const item of inventoryItems) await ctx.db.delete("inventoryItems", item._id);
}

export const resetScenario = mutation({
  args: {},
  returns: v.id("demoRuns"),
  handler: async (ctx) => {
    const priorRuns = await ctx.db.query("demoRuns").withIndex("by_started_at").take(100);
    for (const run of priorRuns) {
      await deleteRunData(ctx, run._id);
      await ctx.db.patch("demoRuns", run._id, { status: "reset", completedAt: Date.now() });
    }

    let organization = await ctx.db
      .query("organizations")
      .withIndex("by_name", (q) => q.eq("name", "Acme Foods"))
      .unique();
    if (organization === null) {
      const organizationId = await ctx.db.insert("organizations", {
        name: "Acme Foods",
        address: {
          line1: "100 Demo Way",
          city: "Cedar Rapids",
          region: "IA",
          postalCode: "52401",
          countryCode: "US",
        },
        timezone: "America/Chicago",
        approvalPolicy: { humanApprovalRequired: true, maximumAutomaticFollowUps: 1 },
        isDemo: true,
      });
      organization = await ctx.db.get("organizations", organizationId);
    }
    if (organization === null) throw new Error("Could not create the demo organization.");

    const now = Date.now();
    const asOf = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00.000Z`);
    const demoRunId = await ctx.db.insert("demoRuns", {
      label: `Acme rehearsal ${new Date(now).toISOString()}`,
      status: "ready",
      scenarioVersion: SCENARIO_VERSION,
      startedAt: now,
      isDemo: true,
    });

    const itemDefinitions = [
      {
        sku: "LID-16-TE",
        name: "Tamper-Evident 16 oz Deli Lid",
        description: "Clear PET lid with a tamper-evident locking tab.",
        specification: {
          productType: "deli lid",
          capacityOunces: 16,
          material: "PET",
          color: "clear",
          tamperEvident: true,
          foodContactCompliant: true,
        },
        quantityOnHand: 3_240,
        safetyStockDays: 3,
        casePack: 500,
        preferredCoverageDays: 14,
        maximumInventoryDays: 30,
        status: "watch" as const,
      },
      {
        sku: "CONTAINER-16",
        name: "16 oz Deli Container",
        description: "Clear food-service container matched to the critical lid.",
        specification: {
          productType: "deli container",
          capacityOunces: 16,
          material: "PET",
          color: "clear",
          foodContactCompliant: true,
        },
        quantityOnHand: 12_480,
        safetyStockDays: 5,
        casePack: 500,
        preferredCoverageDays: 21,
        maximumInventoryDays: 45,
        status: "healthy" as const,
      },
      {
        sku: "CASE-SHIP-12",
        name: "12 × 12 Shipping Case",
        description: "Corrugated case for finished deli products.",
        specification: { productType: "shipping case", material: "corrugated kraft" },
        quantityOnHand: 620,
        safetyStockDays: 4,
        casePack: 25,
        preferredCoverageDays: 14,
        maximumInventoryDays: 30,
        status: "watch" as const,
      },
    ];

    const itemIds = new Map<string, Id<"inventoryItems">>();
    for (const definition of itemDefinitions) {
      const itemId = await ctx.db.insert("inventoryItems", {
        organizationId: organization._id,
        demoRunId,
        ...definition,
        isDemo: true,
      });
      itemIds.set(definition.sku, itemId);
      for (let dayIndex = 0; dayIndex < 90; dayIndex += 1) {
        await ctx.db.insert("inventoryUsage", {
          inventoryItemId: itemId,
          demoRunId,
          date: isoDateAtOffset(asOf, dayIndex - 89),
          quantityConsumed: usageForSku(definition.sku, dayIndex),
          isDemo: true,
        });
      }
    }

    const supplierDefinitions = [
      {
        name: "Apex Packaging",
        domain: "apex-packaging.example",
        relationship: "incumbent" as const,
        historicalReliability: 0.94,
        historicalLeadTimeDays: 7,
        priorUnitPriceMicrodollars: 87_000,
        priorFreightCents: 12_000,
        paymentTerms: "Net 30",
      },
      {
        name: "SupplyCo",
        domain: "supplyco.example",
        relationship: "controlled_demo" as const,
      },
      {
        name: "RestaurantSupply",
        domain: "restaurantsupply.example",
        relationship: "controlled_demo" as const,
      },
    ];

    const supplierIds = new Map<string, Id<"suppliers">>();
    for (const supplier of supplierDefinitions) {
      const supplierId = await ctx.db.insert("suppliers", {
        organizationId: organization._id,
        demoRunId,
        ...supplier,
        isDemo: true,
      });
      supplierIds.set(supplier.name, supplierId);
    }

    const identities = [
      [
        "Apex Packaging",
        "incumbent",
        "apex@demo.example",
        "Cheap, but replies with an arrival after the required date.",
      ],
      [
        "SupplyCo",
        "winning",
        "supplyco@demo.example",
        "Can meet the date, omits freight, then answers one follow-up.",
      ],
      [
        "RestaurantSupply",
        "cheapest",
        "restaurantsupply@demo.example",
        "Lowest price, but replies with an unacceptable arrival date.",
      ],
    ] as const;
    for (const [name, label, email, responsePlan] of identities) {
      const supplierId = supplierIds.get(name);
      if (supplierId === undefined) throw new Error(`Missing seeded supplier: ${name}.`);
      await ctx.db.insert("demoSupplierIdentities", {
        demoRunId,
        supplierId,
        label,
        displayName: name,
        email,
        responsePlan,
        isDemo: true,
      });
    }

    const lidId = itemIds.get("LID-16-TE");
    const apexId = supplierIds.get("Apex Packaging");
    if (lidId === undefined || apexId === undefined) throw new Error("Missing core demo records.");
    for (const [daysAgo, quantity, onTime] of [
      [84, 15_000, true],
      [56, 15_000, true],
      [28, 20_000, false],
    ] as const) {
      await ctx.db.insert("purchaseHistory", {
        demoRunId,
        organizationId: organization._id,
        inventoryItemId: lidId,
        supplierId: apexId,
        purchasedOn: isoDateAtOffset(asOf, -daysAgo),
        quantity,
        unitPriceMicrodollars: 87_000,
        freightCents: 12_000,
        leadTimeDays: 7,
        arrivedOnTime: onTime,
        isDemo: true,
      });
    }

    await ctx.db.insert("historicalMetrics", {
      demoRunId,
      organizationId: organization._id,
      annualSpendCents: 28_432_000,
      savingsIdentifiedCents: 1_743_000,
      projectedStockouts: 0,
      autonomousProcurementPercent: 71,
      isDemo: true,
    });

    return demoRunId;
  },
});

export const startScenario = mutation({
  args: { demoRunId: v.id("demoRuns") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const run = await ctx.db.get("demoRuns", args.demoRunId);
    if (run === null || !run.isDemo) throw new Error("Demo run not found.");
    if (run.status !== "ready") throw new Error("Only a ready demo run can be started.");
    const inventoryItems = await ctx.db
      .query("inventoryItems")
      .withIndex("by_demo_run", (q) => q.eq("demoRunId", run._id))
      .take(20);
    const asOfDate = new Date().toISOString().slice(0, 10);

    for (const item of inventoryItems) {
      if (item.sku !== "LID-16-TE") continue;
      const usage = await ctx.db
        .query("inventoryUsage")
        .withIndex("by_item_date", (q) => q.eq("inventoryItemId", item._id))
        .order("desc")
        .take(90);
      const averageDailyUsage = trailing30DayAverageUsage(usage, asOfDate);
      const stockoutDate = projectedStockoutDate(asOfDate, item.quantityOnHand, averageDailyUsage);
      if (stockoutDate === null) continue;

      const supplierLeadTimeDays = 7;
      const safetyThreshold = averageDailyUsage * (supplierLeadTimeDays + item.safetyStockDays);
      if (item.quantityOnHand > safetyThreshold) continue;

      const existing = await ctx.db
        .query("procurements")
        .withIndex("by_demo_run_and_item_and_is_active", (q) =>
          q.eq("demoRunId", run._id).eq("inventoryItemId", item._id).eq("isActive", true),
        )
        .unique();
      if (existing !== null) continue;

      const requiredInventory = coverageDemand(
        averageDailyUsage,
        supplierLeadTimeDays,
        item.safetyStockDays,
        item.preferredCoverageDays,
      );
      const rounded = roundOrderQuantity({
        requiredQuantity: requiredInventory,
        casePack: item.casePack,
      });
      if (rounded.status !== "ok" || rounded.quantity === null) {
        throw new Error(`Could not calculate a safe order quantity for ${item.sku}.`);
      }

      const now = Date.now();
      const code = `PC-${String(Math.floor(now / 1000) % 10_000).padStart(4, "0")}`;
      const triggerReason = "Projected stockout before normal replenishment can arrive.";
      const procurementId = await ctx.db.insert("procurements", {
        organizationId: item.organizationId,
        inventoryItemId: item._id,
        demoRunId: run._id,
        status: "detected",
        reviewStatus: "resolved",
        isActive: true,
        triggerReason,
        quantityRequired: rounded.quantity,
        requiredBy: stockoutDate,
        averageDailyUsage,
        projectedStockoutDate: stockoutDate,
        calculationVersion: RISK_CALCULATION_VERSION,
        calculationInputs: {
          asOfDate,
          quantityOnHand: item.quantityOnHand,
          trailingUsageDays: 30,
          safetyStockDays: item.safetyStockDays,
          supplierLeadTimeDays,
          coverageDays: item.preferredCoverageDays,
          casePack: item.casePack,
          incomingQuantity: 0,
        },
        code,
        createdAt: now,
        updatedAt: now,
      });
      await ctx.db.insert("procurementEvents", {
        procurementId,
        demoRunId: run._id,
        type: "risk_detected",
        summary: triggerReason,
        actorType: "system",
        toState: "detected",
        createdAt: now,
      });
      await ctx.db.insert("procurementEvents", {
        procurementId,
        demoRunId: run._id,
        type: "state_transitioned",
        summary: "Inventory inputs are being checked.",
        actorType: "agent",
        fromState: "detected",
        toState: "analyzing",
        createdAt: now + 1,
      });
      await ctx.db.patch("procurements", procurementId, {
        status: "sourcing",
        updatedAt: now + 2,
      });
      await ctx.db.insert("procurementEvents", {
        procurementId,
        demoRunId: run._id,
        type: "state_transitioned",
        summary: "Risk confirmed. Supplier sourcing has started.",
        actorType: "agent",
        fromState: "analyzing",
        toState: "sourcing",
        createdAt: now + 2,
      });
      await ctx.db.patch("inventoryItems", item._id, { status: "action_required" });
    }

    await ctx.db.patch("demoRuns", run._id, { status: "active" });
    return null;
  },
});

export const getCurrentScenario = query({
  args: {},
  returns: v.union(scenarioValidator, v.null()),
  handler: async (ctx) => {
    const runs = await ctx.db.query("demoRuns").withIndex("by_started_at").order("desc").take(1);
    const run = runs[0];
    if (run === undefined) return null;
    const inventoryItems = await ctx.db
      .query("inventoryItems")
      .withIndex("by_demo_run", (q) => q.eq("demoRunId", run._id))
      .take(20);
    const inventory = [];
    let usageRecordCount = 0;
    for (const item of inventoryItems) {
      const usage = await ctx.db
        .query("inventoryUsage")
        .withIndex("by_item_date", (q) => q.eq("inventoryItemId", item._id))
        .order("desc")
        .take(90);
      usageRecordCount += usage.length;
      const last30 = usage.slice(0, 30);
      const averageDailyUsage =
        last30.reduce((total, record) => total + record.quantityConsumed, 0) / 30;
      inventory.push({
        sku: item.sku,
        name: item.name,
        quantityOnHand: item.quantityOnHand,
        averageDailyUsage,
        safetyStockDays: item.safetyStockDays,
        casePack: item.casePack,
        status: item.status,
        isDemo: item.isDemo,
      });
    }
    const purchaseHistory = await ctx.db
      .query("purchaseHistory")
      .withIndex("by_demo_run", (q) => q.eq("demoRunId", run._id))
      .take(100);
    const identities = await ctx.db
      .query("demoSupplierIdentities")
      .withIndex("by_demo_run", (q) => q.eq("demoRunId", run._id))
      .take(20);
    const metrics = await ctx.db
      .query("historicalMetrics")
      .withIndex("by_demo_run", (q) => q.eq("demoRunId", run._id))
      .take(1);
    return {
      demoRunId: run._id,
      status: run.status,
      scenarioVersion: run.scenarioVersion,
      inventory,
      usageRecordCount,
      purchaseHistoryCount: purchaseHistory.length,
      controlledIdentityCount: identities.length,
      metricsAreDemo: metrics[0]?.isDemo === true,
    };
  },
});
