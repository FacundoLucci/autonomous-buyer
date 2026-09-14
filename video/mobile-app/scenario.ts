import type { ComponentProps } from "react";
import type { Id, Doc } from "../../convex/_generated/dataModel";
import type { AgentMessage } from "../../src/components/desk/agent";
import type { PurchasingInboxContent } from "../../src/components/desk/mail";
import type { Buy, Item, Snapshot, Workspace } from "../../src/components/desk/model";

export const duration = 90;
export const now = Date.UTC(2026, 8, 13, 10);
export const day = "2026-09-14";
export const handoff =
  "The shipment’s ruined. I’m getting emergency cups and bread for the next few days. Please arrange the quickest replacements.";
export const change = "Send the bread to our other location at 200 Market Street.";
const noopId = <T extends "inventoryItems" | "organizations" | "users" | "companyOrders">(
  s: string,
) => s as Id<T>;

function item(key: string, name: string, unit: string, supplier: string): Item {
  return {
    id: noopId<"inventoryItems">(key),
    name,
    unit,
    sku: key.toUpperCase(),
    supplier,
    quantity: 0,
    estimatedQuantity: 0,
    dailyUsage: unit === "cases" ? 1 : 60,
    leadTimeDays: 1,
    evidence: null,
    sourceUrl: null,
    sourceLabel: null,
    sourceId: null,
    buyUrl: null,
    supplierEmail: unit === "rolls" ? "orders@neighborhoodbakery.example" : null,
    coverageDays: 3,
    forecastQuantity: undefined,
    forecastAt: undefined,
    replenishmentEnabled: true,
    automationState: "watching",
    automationNote: "Replacement supply is being arranged.",
    preparationDays: 1,
    orderMultiple: 1,
    preferredCoverageDays: 3,
    casePack: unit === "cases" ? 500 : 1,
    stockCountedAt: now,
    safetyStockDays: 1,
    buyingPriority: "availability",
    dailyLossCents: null,
    lossCurrency: "USD",
    stockoutImpact: "Keep the deli serving customers",
  };
}
export const items = [
  item("film-cups", "12 oz paper cups", "cases", "Cup Supply"),
  item("film-bread", "Bread rolls", "rolls", "Neighborhood Bakery"),
];
export const workspace: Workspace = {
  organizationId: noopId<"organizations">("film-deli"),
  companyName: "Market Street Deli",
  shippingAddress: "100 Market Street, Chicago, IL 60601",
  inbox: null,
  items,
};
function order(i: Item, status: Doc<"companyOrders">["status"]): Doc<"companyOrders"> {
  const cups = i.unit === "cases";
  return {
    _id: noopId<"companyOrders">(`film-order-${i.id}`),
    _creationTime: now,
    organizationId: workspace.organizationId,
    inventoryItemId: i.id,
    createdBy: noopId<"users">("film-owner"),
    number: cups ? "BH-101" : "BH-102",
    itemName: i.name,
    sku: i.sku,
    unit: i.unit,
    quantity: cups ? 4 : 120,
    receivedQuantity: 0,
    unitPriceCents: cups ? 2400 : 70,
    freightCents: 0,
    taxCents: 0,
    totalCents: cups ? 9600 : 8400,
    currency: "USD",
    supplier: i.supplier!,
    shipTo: workspace.shippingAddress!,
    requiredBy: day,
    quotedArrival: day,
    expectedOn: day,
    notes: cups
      ? "2,000 cups. Delivery tomorrow by 5 pm."
      : "120 rolls. Delivery tomorrow before 7 am.",
    orderingMethod: cups ? "website" : "purchase_order",
    supplierPoVerified: !cups,
    supplierEmail: cups ? undefined : "orders@neighborhoodbakery.example",
    buyUrl: cups ? "https://cups.example/12oz" : undefined,
    status,
    isOpen: true,
    createdAt: now,
    updatedAt: now,
    confirmation: status === "placed" ? (cups ? "CUPS-101" : "BAKERY-102") : undefined,
  };
}
export function snapshotAt(time: number): Snapshot {
  const buys: Buy[] =
    time < 11
      ? []
      : items.map((i, index) => ({
          id: index === 0 ? "cups" : "bread",
          itemId: i.id,
          name: i.name,
          unit: i.unit,
          quantity: index === 0 ? 4 : 120,
          requiredBy: day,
          closed: false,
          createdAt: now,
          automatic: true,
          planVersion: 1,
          purchasingState:
            time < (index === 0 ? 27 : 50)
              ? index === 0
                ? "researching"
                : "waiting_supplier"
              : "ready",
          purchasingNote:
            index === 0
              ? "Checking the quickest online delivery."
              : "Checking delivery with the bakery by email.",
          order: time >= (index === 0 ? 27 : 50) ? order(i, time >= 69 ? "placed" : "draft") : null,
        }));
  return { buys, activity: [], truncated: false };
}

type Event = { id: string; role: AgentMessage["role"]; text: string; at: number; until?: number };
export const events: Event[] = [
  { id: "handoff", role: "user", text: handoff, at: 10 },
  {
    id: "got-it",
    role: "assistant",
    text: "I’ve got this. I’ll find the quickest replacement cups and email the bakery about the bread. You handle the shop.",
    at: 11.3,
    until: 18.4,
  },
  {
    id: "cups-found",
    role: "assistant",
    text: "The same 12 oz cups are available online: four cases, $96 delivered, tomorrow by 5 pm.",
    at: 24,
    until: 28,
  },
  {
    id: "followup",
    role: "assistant",
    text: "The bakery has a price. I’m checking that they can deliver before 7 am tomorrow.",
    at: 42,
    until: 44.5,
  },
  {
    id: "plan",
    role: "assistant",
    text: "Both replacements are ready: cups, $96, tomorrow by 5 pm. Bread, $84, tomorrow before 7 am. $180 delivered in total.",
    at: 50,
    until: 56,
  },
  { id: "approved", role: "user", text: "Go ahead with both.", at: 67.6 },
  {
    id: "confirmed",
    role: "assistant",
    text: "Both orders are confirmed. Cups arrive tomorrow by 5 pm. The bakery confirmed the bread for before 7 am.",
    at: 68.6,
    until: 73.8,
  },
  { id: "change", role: "user", text: change, at: 83 },
  {
    id: "change-ack",
    role: "assistant",
    text: "Got it. I’ll ask the bakery to change the address and let you know when they confirm.",
    at: 84,
    until: 88.5,
  },
];
export function reveal(text: string, progress: number) {
  const words = text.match(/\S+\s*/g) ?? [];
  return words
    .slice(0, Math.floor(Math.max(0, Math.min(1, progress)) * words.length))
    .join("")
    .trimEnd();
}
export function messagesAt(time: number): AgentMessage[] {
  return events
    .filter((e) => time >= e.at)
    .map((e) => ({
      id: e.id,
      role: e.role,
      createdAt: now + e.at * 1000,
      text: e.until ? reveal(e.text, (time - e.at) / (e.until - e.at)) : e.text,
    }))
    .filter((m) => m.text);
}
export function inputAt(time: number) {
  const typed = (value: string, start: number, end: number) =>
    value.slice(
      0,
      Math.floor(value.length * Math.max(0, Math.min(1, (time - start) / (end - start)))),
    );
  if (time >= 2 && time < 10) return typed(handoff, 2, 9.6);
  if (time >= 66 && time < 67.6) return typed("Go ahead with both.", 66, 67.3);
  if (time >= 78 && time < 83) return typed(change, 78, 82.6);
  return "";
}

type Mail = NonNullable<ComponentProps<typeof PurchasingInboxContent>["message"]>;
export const emails: Record<string, Mail> = {
  enquiry: {
    subject: "Replacement bread for tomorrow",
    from: "buyer@marketstreetdeli.example",
    text: "Our shipment was damaged. Can you supply 120 bread rolls? Please confirm your total, including delivery, and the earliest arrival.\n\nThank you,\nMarket Street Deli",
  },
  price: {
    subject: "Re: Replacement bread for tomorrow",
    from: "orders@neighborhoodbakery.example",
    text: "We can supply 120 rolls. The total is $84, including delivery.\n\nNeighborhood Bakery",
  },
  delivery: {
    subject: "Re: Replacement bread for tomorrow",
    from: "orders@neighborhoodbakery.example",
    text: "Yes, we can deliver tomorrow before 7 am.\n\n120 bread rolls — $84 total, including delivery.\n\nNeighborhood Bakery",
  },
  confirmation: {
    subject: "Order confirmed — 120 bread rolls",
    from: "orders@neighborhoodbakery.example",
    text: "Your order is confirmed.\n\n120 bread rolls\n$84, including delivery\nTomorrow, before 7 am\n100 Market Street\n\nNeighborhood Bakery",
  },
};
export function emailAt(time: number): Mail | null {
  if (time >= 32 && time < 37) return emails.enquiry;
  if (time >= 37 && time < 42) return emails.price;
  if (time >= 44.5 && time < 50) return emails.delivery;
  if (time >= 74 && time < 78) return emails.confirmation;
  return null;
}
