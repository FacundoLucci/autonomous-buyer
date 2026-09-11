const key = "buyhard-attribution-v1";
export const campaignKeys = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
export type Attribution = {
  visitorId: string;
  landingPath: string;
  referrer: string;
  capturedAt: number;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
};
let memory: Attribution | undefined;
export function attribution(): Attribution {
  if (memory) return memory;
  let stored: Attribution | null = null;
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null") as Attribution | null;
    if (
      value &&
      typeof value.visitorId === "string" &&
      Date.now() - value.capturedAt < 30 * 86400000
    )
      stored = value;
  } catch {
    /* Storage is optional. */
  }
  const params = new URLSearchParams(location.search);
  const hasCampaign = campaignKeys.some((name) => params.has(name));
  const sameCampaign =
    stored && campaignKeys.every((name) => (stored[name] ?? "") === (params.get(name) ?? ""));
  memory =
    stored && (!hasCampaign || sameCampaign)
      ? stored
      : {
          visitorId: stored?.visitorId ?? crypto.randomUUID(),
          landingPath: location.pathname.slice(0, 200),
          referrer: document.referrer ? new URL(document.referrer).origin : "",
          capturedAt: Date.now(),
        };
  if (hasCampaign)
    for (const name of campaignKeys) {
      const value = params.get(name);
      if (value) memory[name] = value.slice(0, 200);
    }
  try {
    localStorage.setItem(key, JSON.stringify(memory));
  } catch {
    /* Keep the in-memory fallback. */
  }
  return memory;
}
export function marketingHref(path: string) {
  if (typeof window === "undefined" || !window.location) return path;
  const url = new URL(path, location.origin);
  const source = attribution();
  for (const name of campaignKeys) if (source[name]) url.searchParams.set(name, source[name]);
  return `${url.pathname}${url.search}${url.hash}`;
}
export function bookingUrl() {
  const url = new URL("https://cal.com/facundolucci/buyhard");
  const source = attribution();
  for (const name of campaignKeys) if (source[name]) url.searchParams.set(name, source[name]);
  url.searchParams.set("metadata[visitorId]", source.visitorId);
  url.searchParams.set("metadata[attribution]", JSON.stringify(source));
  return url.href;
}
