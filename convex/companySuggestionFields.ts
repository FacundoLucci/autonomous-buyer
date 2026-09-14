import { defineTable } from "convex/server";
import { v } from "convex/values";
export const companySuggestions = defineTable({
  userId: v.id("users"),
  domain: v.string(),
  createdAt: v.number(),
  status: v.union(
    v.literal("pending"),
    v.literal("ready"),
    v.literal("offered"),
    v.literal("dismissed"),
    v.literal("unavailable"),
  ),
  companyName: v.optional(v.string()),
  shippingAddress: v.optional(v.string()),
  sourceUrl: v.optional(v.string()),
}).index("by_userId", ["userId"]);

export function passkeyEmail(value: string | null) {
  const email = value?.trim().toLowerCase() ?? "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("Enter a valid email address.");
  return email;
}
export function businessDomain(email: string) {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain || !/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?\.[a-z]{2,}$/.test(domain)) return null;
  const personal = [
    "gmail.com",
    "googlemail.com",
    "outlook.com",
    "hotmail.com",
    "live.com",
    "msn.com",
    "yahoo.com",
    "ymail.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "aol.com",
    "proton.me",
    "protonmail.com",
    "pm.me",
    "fastmail.com",
    "hey.com",
    "mail.com",
    "gmx.com",
    "gmx.de",
    "yandex.com",
    "yandex.ru",
    "qq.com",
    "163.com",
  ];
  if (personal.includes(domain) || /^(?:yahoo|hotmail|outlook|live)\./.test(domain)) return null;
  return domain;
}
