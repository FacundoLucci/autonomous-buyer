import { v } from "convex/values";
import { ConvexError } from "convex/values";
export const supplierChannels = v.union(
  v.literal("unknown"),
  v.literal("browser"),
  v.literal("email"),
  v.literal("both"),
);
export const supplierEvidence = v.object({ url: v.string(), excerpt: v.string() });
export function supplierWebsite(value: string) {
  let parsed: URL;
  try {
    parsed = new URL(value.includes("://") ? value.trim() : `https://${value.trim()}`);
  } catch {
    throw new ConvexError("Enter a public supplier website.");
  }
  if (
    parsed.protocol !== "https:" ||
    parsed.username ||
    parsed.password ||
    parsed.port ||
    value.length > 2000 ||
    !parsed.hostname.includes(".") ||
    /(^localhost$|\.local$|\.internal$|^\d|:)/i.test(parsed.hostname)
  )
    throw new ConvexError("Use a public https supplier website.");
  const domain = parsed.hostname.toLowerCase().replace(/^www\./, "");
  parsed.search = "";
  parsed.hash = "";
  return { url: parsed.href, domain };
}
export function emailOrderingEvidence(excerpt: string, email: string) {
  const emails: string[] =
    excerpt.toLowerCase().match(/[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/g) ?? [];
  return (
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    emails.includes(email.toLowerCase()) &&
    /\b(?:purchase orders?|orders?)\b/i.test(excerpt) &&
    /\b(?:email|e-mail)\b/i.test(excerpt) &&
    /\b(?:accept|send|submit|place)\b/i.test(excerpt) &&
    !/\b(?:not|no|cannot|can't|don't|doesn't|do not|except|only if|unable)\b/i.test(excerpt)
  );
}
export function browserOrderingEvidence(excerpt: string) {
  return (
    /\b(?:checkout|check out|add to cart|shopping cart|order online|buy now)\b/i.test(excerpt) &&
    !/\b(?:not|cannot|unavailable|disabled)\b/i.test(excerpt)
  );
}

export function emailEvidenceInContext(source: string, excerpt: string, email: string) {
  const offset = source.indexOf(excerpt);
  if (offset < 0 || !emailOrderingEvidence(excerpt, email)) return false;
  // Check the entire containing line so an affirmative fragment cannot omit "do not".
  const before = source.lastIndexOf("\n", offset) + 1;
  const next = source.indexOf("\n", offset + excerpt.length);
  return emailOrderingEvidence(source.slice(before, next < 0 ? source.length : next), email);
}
