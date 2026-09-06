// Development only: a disposable password account checks compatibility and a live source read.
import { ConvexHttpClient } from "convex/browser";
import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import assert from "node:assert/strict";
const c = new ConvexHttpClient("https://festive-coyote-483.convex.cloud", { logger: false });
const email = `link-qa-${Date.now()}@buyer-test.example`,
  password = randomBytes(24).toString("base64url");
const signup = await c.action("auth:signIn", {
  provider: "password",
  params: { email, password, flow: "signUp" },
});
c.setAuth(signup.tokens.token);
assert.equal((await c.query("authData:getCurrentUser", {})).role, "viewer");
c.clearAuth();
const login = await c.action("auth:signIn", {
  provider: "password",
  params: { email, password, flow: "signIn" },
});
c.setAuth(login.tokens.token);
assert.equal((await c.query("authData:getCurrentUser", {})).email, email);
console.log("PASS legacy password login alongside Auth 2");
const url =
  "https://www.webstaurantstore.com/choice-heavy-duty-16-oz-translucent-plastic-deli-container-and-lid-combo-pack-case/128HD16COMBO.html";
const sourceId = await c.mutation("inventorySources:startLink", { url });
let source;
for (let i = 0; i < 80; i++) {
  source = await c.query("inventorySources:get", { sourceId });
  if (source.status === "ready" || source.status === "failed") break;
  await new Promise((r) => setTimeout(r, 1500));
}
assert.equal(source.status, "ready", source.message);
assert.equal(source.products.length, 1);
assert.ok(source.products.some((p) => /16/.test(p.name) && p.packSize === 240));
assert.equal(source.products[0].supplier, "webstaurantstore.com");
assert.equal(source.products[0].leadTimeDays, null);
assert.equal(source.products[0].unit, "cases");
console.log(
  "PASS real Firecrawl product page extraction: primary product, storefront, pack, unknown delivery",
);
console.log(
  source.products.map(({ name, supplier, packSize, leadTimeDays }) => ({
    name,
    supplier,
    packSize,
    leadTimeDays,
  })),
);
writeFileSync(
  "output/onboarding/product-link-check.json",
  JSON.stringify(
    { sourceId, url, products: source.products, legacyPasswordLogin: true, emailsSent: 0 },
    null,
    2,
  ) + "\n",
);
await c.action("auth:signOut", {});
