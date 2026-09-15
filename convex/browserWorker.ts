import { env } from "./_generated/server";
import { ConvexError } from "convex/values";

export async function browserWorker(path: string, body?: unknown): Promise<unknown> {
  if (!env.BROWSER_WORKER_URL || !env.BROWSER_WORKER_SECRET)
    throw new ConvexError("Website ordering needs the browser service to be connected.");
  const base = new URL(env.BROWSER_WORKER_URL);
  if (base.protocol !== "https:") throw new ConvexError("The browser service must use HTTPS.");
  const response = await fetch(new URL(path, base), {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${env.BROWSER_WORKER_SECRET}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(25000),
  });
  if (!response.ok)
    throw new ConvexError(
      response.status === 409
        ? "This checkout changed or needs attention. Refresh the purchase before continuing."
        : "The browser service could not complete this request. Please try again.",
    );
  return await response.json();
}
