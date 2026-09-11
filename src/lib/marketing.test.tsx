import { afterEach, expect, test, vi } from "vitest";
const stored = new Map<string, string>();
async function arrival(url: string) {
  vi.resetModules();
  const location = new URL(url);
  vi.stubGlobal("window", { location });
  vi.stubGlobal("location", location);
  vi.stubGlobal("document", { referrer: "https://example.com/post" });
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
  return import("./marketing");
}
afterEach(() => {
  stored.clear();
  vi.unstubAllGlobals();
});
test("campaign survives demo and booking with original arrival path", async () => {
  const first = await arrival("https://buyhard.test/?utm_source=linkedin&utm_campaign=pilot");
  const original = first.attribution();
  expect(first.marketingHref("/?demo=true")).toContain(
    "demo=true&utm_source=linkedin&utm_campaign=pilot",
  );
  const next = await arrival(
    "https://buyhard.test/walkthrough?utm_source=linkedin&utm_campaign=pilot",
  );
  expect(next.attribution()).toEqual(original);
  const cal = new URL(next.bookingUrl());
  expect(JSON.parse(cal.searchParams.get("metadata[attribution]")!)).toEqual(original);
});
test("new campaign replaces attribution while direct returns keep the source", async () => {
  const first = await arrival("https://buyhard.test/?utm_source=linkedin");
  const id = first.attribution().visitorId;
  const second = await arrival("https://buyhard.test/?utm_source=email");
  expect(second.attribution()).toMatchObject({ visitorId: id, utm_source: "email" });
  const direct = await arrival("https://buyhard.test/?demo=true");
  expect(direct.attribution().utm_source).toBe("email");
});
