const encoder = new TextEncoder();
export function base64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}
function decode(value: string) {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}
export async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(message)));
}
export async function verifyHmac(
  secret: string,
  message: string,
  signature: string,
  encoding: "base64" | "hex" = "base64",
) {
  try {
    if (encoding === "hex" && !/^[0-9a-f]{64}$/i.test(signature)) return false;
    const bytes =
      encoding === "hex"
        ? Uint8Array.from(signature.match(/../g)!, (s) => parseInt(s, 16))
        : decode(signature);
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify("HMAC", key, bytes, encoder.encode(message));
  } catch {
    return false;
  }
}
export async function seal(value: unknown, secret: string) {
  const raw = decode(secret);
  if (raw.length !== 32) throw new Error("Set a 32-byte SALES_CREDENTIAL_KEY.");
  const key = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const bytes = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(value)),
  );
  return base64(iv) + "." + base64(new Uint8Array(bytes));
}
export async function unseal(value: string, secret: string): Promise<unknown> {
  const [iv, payload] = value.split(".");
  const key = await crypto.subtle.importKey("raw", decode(secret), "AES-GCM", false, ["decrypt"]);
  return JSON.parse(
    new TextDecoder().decode(
      await crypto.subtle.decrypt({ name: "AES-GCM", iv: decode(iv) }, key, decode(payload)),
    ),
  );
}
export const randomKey = () =>
  base64(crypto.getRandomValues(new Uint8Array(32)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
