import type { MutationBuilder } from "convex/server";
import {
  mutation as baseMutation,
  internalMutation as baseInternalMutation,
  type MutationCtx,
} from "./_generated/server";
import type { DataModel, Doc, Id } from "./_generated/dataModel";
import { getAuthUserId } from "./identity";

// Business changes only: never copy credentials, auth records, or chat contents.
const fields = {
  inventoryItems: [
    "name",
    "sku",
    "description",
    "specification",
    "casePack",
    "preferredCoverageDays",
    "maximumInventoryDays",
    "leadTimeEvidence",
    "leadTimeConfirmedAt",
    "unit",
    "quantityOnHand",
    "stockCountKnown",
    "stockCountedAt",
    "estimatedDailyUsage",
    "supplierLeadTimeDays",
    "safetyStockDays",
    "supplierName",
    "supplierEmail",
    "buyUrl",
    "buyingPriority",
    "dailyLossCents",
    "lossCurrency",
    "stockoutImpact",
    "archived",
  ],
  companyBuys: ["itemId", "quantity", "requiredBy", "notes", "orderId", "closed"],
  companyOrders: [
    "reviewRequired",
    "requestedQuantity",
    "quotedArrival",
    "number",
    "itemName",
    "sku",
    "unit",
    "quantity",
    "receivedQuantity",
    "unitPriceCents",
    "freightCents",
    "taxCents",
    "totalCents",
    "currency",
    "supplier",
    "supplierEmail",
    "buyUrl",
    "shipTo",
    "requiredBy",
    "notes",
    "status",
    "approvedAt",
    "placedAt",
    "expectedOn",
    "confirmation",
    "error",
  ],
  organizations: ["name", "address", "shippingAddress", "timezone", "approvalPolicy"],
  companyAlertSettings: ["email", "lowStock", "orderUpdates", "verifiedAt"],
} as const;
type Table = keyof typeof fields;
type BusinessDoc = Doc<Table>;

function wrap<Visibility extends "public" | "internal">(
  builder: MutationBuilder<DataModel, Visibility>,
): MutationBuilder<DataModel, Visibility> {
  return ((definition: Parameters<typeof builder>[0]) => {
    const handler = typeof definition === "function" ? definition : definition.handler;
    return builder({
      ...(typeof definition === "function" ? {} : definition),
      handler: async (ctx: MutationCtx, args: Record<string, unknown>) => {
        const changes = new Map<string, { table: Table; before: BusinessDoc | null }>();
        let userId = await getAuthUserId(ctx);
        let viaChat = false;
        if (typeof args.chatId === "string") {
          const id = ctx.db.normalizeId("taskChats", args.chatId);
          const chat = id ? await ctx.db.get("taskChats", id) : null;
          if (chat && (!userId || chat.userId === userId)) {
            userId ??= chat.userId;
            viaChat = true;
          }
        }
        const user = userId ? await ctx.db.get("users", userId) : null;
        const db = new Proxy(ctx.db, {
          get(target, property, receiver) {
            const method = Reflect.get(target, property, receiver);
            if (!["insert", "patch", "replace", "delete"].includes(String(property)))
              return typeof method === "function" ? method.bind(target) : method;
            return async (...input: unknown[]) => {
              const explicit = typeof input[0] === "string" && input[0] in fields;
              const table = explicit
                ? (input[0] as Table)
                : property !== "insert" && typeof input[0] === "string"
                  ? (Object.keys(fields) as Table[]).find((t) =>
                      target.normalizeId(t, input[0] as string),
                    )
                  : undefined;
              const id = (explicit ? input[1] : input[0]) as Id<Table>;
              if (table && property !== "insert" && !changes.has(id))
                changes.set(id, { table, before: await target.get(table, id) });
              const result = await method.apply(target, input);
              if (table && property === "insert") changes.set(result, { table, before: null });
              return result;
            };
          },
        });
        const result = await handler({ ...ctx, db }, args);
        for (const [id, { table, before }] of changes) {
          const after = await ctx.db.get(table, id as Id<Table>);
          const record = after ?? before;
          if (!record) continue;
          const organizationId =
            table === "organizations"
              ? (id as Id<"organizations">)
              : "organizationId" in record
                ? record.organizationId
                : undefined;
          if (!organizationId) continue;
          const value = (doc: BusinessDoc | null, key: string) => {
            const entry = doc && (doc as Record<string, unknown>)[key];
            return entry === undefined || entry === null
              ? null
              : typeof entry === "object"
                ? JSON.stringify(entry)
                : String(entry);
          };
          const difference = fields[table]
            .filter((key) => value(before, key) !== value(after, key))
            .map((field) => ({ field, before: value(before, field), after: value(after, field) }));
          if (!difference.length && before && after) continue;
          let name =
            "name" in record
              ? record.name
              : "itemName" in record
                ? record.itemName
                : "Company settings";
          if (table === "companyBuys" && "itemId" in record)
            name = (await ctx.db.get("inventoryItems", record.itemId))?.name ?? "Buy";
          await ctx.db.insert("auditEntries", {
            organizationId,
            entityId: id,
            entityType: table,
            name,
            action: !before ? "created" : !after ? "deleted" : "updated",
            actorId: user?._id,
            actor: user?.name || user?.email || (user ? "Team member" : "System"),
            via: viaChat ? "chat" : user ? "manual" : "system",
            changes: difference,
            createdAt: Date.now(),
          });
        }
        return result;
      },
    });
  }) as MutationBuilder<DataModel, Visibility>;
}

// Use these for every mutation that writes company business records. The log
// commits in the same transaction, including writes made by shared helpers.
export const mutation = wrap(baseMutation);
export const internalMutation = wrap(baseInternalMutation);
