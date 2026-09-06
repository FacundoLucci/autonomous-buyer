// Development-only integration check. Uses disposable identities and a software
// WebAuthn authenticator; it does not access a person's passkeys or send email.
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { writeFileSync } from "node:fs";
import { ConvexHttpClient } from "convex/browser";
const CONVEX_URL = "https://festive-coyote-483.convex.cloud";
const SITE = "https://festive-coyote-483.convex.site";
const ORIGIN = process.env.BUYER_QA_ORIGIN ?? SITE;
const RP_ID = new URL(ORIGIN).hostname;
const checks = [];
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
  console.log(`PASS ${name}`);
};
const buffer = (b) => new Uint8Array(b).buffer;
const hash = (b) => createHash("sha256").update(b).digest();
function cbor(value) {
  const header = (type, n) =>
    n < 24
      ? Buffer.from([(type << 5) | n])
      : n < 256
        ? Buffer.from([(type << 5) | 24, n])
        : Buffer.from([(type << 5) | 25, n >> 8, n & 255]);
  if (typeof value === "number") return value >= 0 ? header(0, value) : header(1, -1 - value);
  if (typeof value === "string") {
    const b = Buffer.from(value);
    return Buffer.concat([header(3, b.length), b]);
  }
  if (Buffer.isBuffer(value)) return Buffer.concat([header(2, value.length), value]);
  if (value instanceof Map) {
    return Buffer.concat([
      header(5, value.size),
      ...[...value].flatMap(([k, v]) => [cbor(k), cbor(v)]),
    ]);
  }
  throw new Error("Unsupported fixture CBOR");
}
async function register(suffix) {
  const client = new ConvexHttpClient(CONVEX_URL, { logger: false });
  const username = `source-qa-${Date.now()}-${suffix}`;
  const begin = await client.mutation("passkeyAuth:startSignIn", { username });
  assert.equal(begin.step, "register");
  const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const jwk = pair.publicKey.export({ format: "jwk" });
  const id = randomBytes(32);
  const key = cbor(
    new Map([
      [1, 2],
      [3, -7],
      [-1, 1],
      [-2, Buffer.from(jwk.x, "base64url")],
      [-3, Buffer.from(jwk.y, "base64url")],
    ]),
  );
  const data = Buffer.concat([
    hash(RP_ID),
    Buffer.from([0x45]),
    Buffer.alloc(4),
    Buffer.alloc(16),
    Buffer.from([0, 32]),
    id,
    key,
  ]);
  const clientData = Buffer.from(
    JSON.stringify({
      type: "webauthn.create",
      challenge: Buffer.from(begin.challenge).toString("base64url"),
      origin: ORIGIN,
      crossOrigin: false,
    }),
  );
  const attestation = cbor(
    new Map([
      ["fmt", "none"],
      ["attStmt", new Map()],
      ["authData", data],
    ]),
  );
  const result = await client.mutation("passkeyAuth:finishSignUp", {
    username,
    clientDataJSON: buffer(clientData),
    attestationObject: buffer(attestation),
  });
  assert.equal(result.success, true);
  client.setAuth(result.tokens.accessToken);
  return { client, username, pair, id, tokens: result.tokens };
}
const a = await register("a");
check(
  "Auth 2 passkey registration creates a private viewer",
  (await a.client.query("authData:getCurrentUser", {})).role === "viewer",
);
check(
  "Signup happens before company creation",
  (await a.client.query("onboarding:getWorkspace", {})) === null,
);
await a.client.mutation("passkeyAuth:signOut", { refreshToken: a.tokens.refreshToken });
a.client.clearAuth();
const begin = await a.client.mutation("passkeyAuth:startSignIn", { username: a.username });
const clientData = Buffer.from(
  JSON.stringify({
    type: "webauthn.get",
    challenge: Buffer.from(begin.challenge).toString("base64url"),
    origin: ORIGIN,
    crossOrigin: false,
  }),
);
const data = Buffer.concat([hash(RP_ID), Buffer.from([0x05]), Buffer.from([0, 0, 0, 1])]);
const result = await a.client.mutation("passkeyAuth:finishSignIn", {
  credentialId: buffer(a.id),
  authenticatorData: buffer(data),
  clientDataJSON: buffer(clientData),
  signature: buffer(sign("sha256", Buffer.concat([data, hash(clientData)]), a.pair.privateKey)),
});
check("Auth 2 sign-out and cryptographic sign-in roundtrip", result.success);
a.client.setAuth(result.tokens.accessToken);
a.tokens = result.tokens;
const guest = new ConvexHttpClient(CONVEX_URL, { logger: false });
await assert.rejects(() =>
  guest.mutation("inventorySources:startLink", { url: "https://example.com/product" }),
);
check("Guests cannot start paid imports", true);
await assert.rejects(() =>
  a.client.mutation("inventorySources:startLink", { url: "https://127.0.0.1/product" }),
);
check("Local product URLs rejected", true);
// A small, synthetic two-line invoice. Quantities are explicitly ordered, not on hand.
const lines = [
  "INVOICE - QA FIXTURE ONLY",
  "Seller: Northline Packaging",
  "Bill to: Buyer QA Foods",
  "Item QA-LID-16: 16 oz deli lids | 500 units per case | 2 cases ordered",
  "Item QA-CUP-16: 16 oz deli cups | 250 units per case | 4 cases ordered",
  "Ships in 2 business days. No delivery commitment stated.",
  "Do not treat ordered quantity as current stock.",
];
const stream = `BT /F1 12 Tf 40 750 Td ${lines.map((l, i) => `${i ? "0 -28 Td " : ""}(${l}) Tj`).join("\n")} ET`;
const objects = [
  "<< /Type /Catalog /Pages 2 0 R >>",
  "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
  "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
  "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  `<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`,
];
let pdf = "%PDF-1.4\n";
const offsets = [0];
for (const [i, o] of objects.entries()) {
  offsets.push(Buffer.byteLength(pdf));
  pdf += `${i + 1} 0 obj\n${o}\nendobj\n`;
}
const xref = Buffer.byteLength(pdf);
pdf += `xref\n0 6\n0000000000 65535 f \n${offsets
  .slice(1)
  .map((o) => String(o).padStart(10, "0") + " 00000 n ")
  .join("\n")}\ntrailer << /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const res = await fetch(`${SITE}/api/inventory/invoice`, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${a.tokens.accessToken}`,
    "Content-Type": "application/pdf",
    "X-Filename": "qa-invoice.pdf",
    Origin: ORIGIN,
  },
  body: pdf,
});
check(
  "Authenticated PDF upload accepts the configured origin",
  res.ok && res.headers.get("Access-Control-Allow-Origin") === ORIGIN,
);
const { sourceId } = await res.json();
let source;
for (let i = 0; i < 60; i++) {
  if (a.tokens.accessTokenExpiresAt < Date.now() + 15000) {
    const next = await a.client.mutation("passkeyAuth:refreshSession", {
      refreshToken: a.tokens.refreshToken,
    });
    assert.ok(next);
    a.tokens = next;
    a.client.setAuth(next.accessToken);
  }
  source = await a.client.query("inventorySources:get", { sourceId });
  if (source.status === "ready" || source.status === "failed") break;
  await new Promise((r) => setTimeout(r, 1500));
}
check("Real invoice extraction finishes", source.status === "ready");
check("Invoice offers both products", source.products.length === 2);
check(
  "Dispatch time is not invented as delivery time",
  source.products.every((p) => p.leadTimeDays === null),
);
check(
  "Seller is extracted instead of bill-to customer",
  source.products.every((p) => p.supplier === "Northline Packaging"),
);
const b = await register("b");
check(
  "Another account cannot read the invoice",
  (await b.client.query("inventorySources:get", { sourceId })) === null,
);
const setup = {
  companyName: "QA Source Foods",
  shippingAddress: "100 Sample Avenue, Chicago, IL 60601, United States",
  timezone: "America/Chicago",
  sourceId,
  productIndex: 0,
  itemName: source.products[0].name,
  quantity: "",
  dailyUsage: "",
  unit: "cases",
};
await assert.rejects(() => b.client.mutation("onboarding:completeFromSource", setup));
check("Another account cannot claim the invoice", true);
await a.client.mutation("onboarding:completeFromSource", setup);
let workspace = await a.client.query("onboarding:getWorkspace", {});
const item = workspace.items[0];
check(
  "First item persists with unknown stock, usage, and delivery",
  item.quantity === null && item.dailyUsage === null && item.leadTimeDays === null,
);
await a.client.mutation("onboarding:completeFromSource", setup);
check(
  "Repeated completion keeps one item",
  (await a.client.query("onboarding:getWorkspace", {})).items.length === 1,
);
await b.client.mutation("onboarding:completeFromSource", {
  ...setup,
  sourceId: undefined,
  productIndex: undefined,
  companyName: "QA Other Foods",
  itemName: "QA item",
});
await assert.rejects(() =>
  b.client.mutation("onboarding:fillGap", { itemId: item.id, field: "leadTimeDays", value: "7" }),
);
check("Company boundaries protect gap answers", true);
await a.client.mutation("onboarding:fillGap", {
  itemId: item.id,
  field: "leadTimeDays",
  value: "5",
});
await a.client.mutation("onboarding:fillGap", { itemId: item.id, field: "dailyUsage", value: "2" });
await a.client.mutation("onboarding:updateStock", { itemId: item.id, quantity: 10 });
workspace = await a.client.query("onboarding:getWorkspace", {});
check(
  "Human gap answers and stock count persist",
  workspace.items[0].leadTimeDays === 5 &&
    workspace.items[0].dailyUsage === 2 &&
    workspace.items[0].quantity === 10,
);
await assert.rejects(() =>
  a.client.mutation("onboarding:fillGap", { itemId: item.id, field: "leadTimeDays", value: "-2" }),
);
check("Invalid answers rejected", true);
writeFileSync(
  "output/onboarding/source-checks.json",
  JSON.stringify(
    {
      checks,
      sourceId,
      organizationId: workspace.organizationId,
      products: source.products,
      emailsSent: 0,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Completed ${checks.length} checks; no emails sent.`);
