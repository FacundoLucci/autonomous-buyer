import { httpAction, env } from "./_generated/server";
import { internal } from "./_generated/api";
const LIMIT = 8 * 1024 * 1024;
function cors(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  const allowed = [env.AUTH_ORIGIN ?? "http://localhost:3000", env.CONVEX_SITE_URL];
  return {
    "Access-Control-Allow-Origin": allowed.includes(origin) ? origin : "null",
    "Access-Control-Allow-Headers": "Authorization,Content-Type,X-Filename",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    Vary: "Origin",
  };
}
export const options = httpAction(
  async (_ctx, request) => new Response(null, { status: 204, headers: cors(request) }),
);
export const upload = httpAction(async (ctx, request) => {
  const headers = { ...cors(request), "Content-Type": "application/json" };
  let sourceId;
  try {
    sourceId = await ctx.runMutation(internal.inventorySources.reserveInvoice, {});
  } catch {
    return new Response(
      JSON.stringify({
        error: "Sign in first, or try again later if you reached the upload limit.",
      }),
      { status: 403, headers },
    );
  }
  try {
    if (Number(request.headers.get("Content-Length")) > LIMIT)
      throw new Error("Use an invoice under 8 MB.");
    const reader = request.body?.getReader();
    if (!reader) throw new Error("Choose an invoice.");
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.length;
      if (size > LIMIT) {
        await reader.cancel();
        throw new Error("Use an invoice under 8 MB.");
      }
      chunks.push(chunk.value as Uint8Array<ArrayBuffer>);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    const type = request.headers.get("Content-Type") ?? "";
    const signature = Array.from(bytes.slice(0, 8)).join(",");
    const valid =
      (type === "application/pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") ||
      (type === "image/png" && signature === "137,80,78,71,13,10,26,10") ||
      (type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255);
    if (!valid) throw new Error("Use a PDF, PNG, or JPG invoice.");
    const fileId = await ctx.storage.store(new Blob([bytes], { type }));
    try {
      await ctx.runMutation(internal.inventorySources.attachInvoice, {
        sourceId,
        fileId,
        filename: decodeURIComponent(request.headers.get("X-Filename") ?? "Invoice").slice(0, 120),
      });
    } catch (cause) {
      await ctx.storage.delete(fileId);
      throw cause;
    }
    return new Response(JSON.stringify({ sourceId }), { status: 200, headers });
  } catch (cause) {
    const message =
      cause instanceof Error && /^(Use |Choose )/.test(cause.message)
        ? cause.message
        : "Upload didn’t finish. Please try again.";
    await ctx.runMutation(internal.inventorySources.fail, { sourceId, message });
    return new Response(JSON.stringify({ error: message }), { status: 400, headers });
  }
});
