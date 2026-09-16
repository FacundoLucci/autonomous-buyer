import { ConvexError } from "convex/values";
import { env, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { record, string } from "./mailContent";
import { unseal } from "./salesCrypto";
export const segment = (value: string) => {
  if (!value || value.length > 1000) throw new ConvexError("Email reference is invalid.");
  return encodeURIComponent(value);
};
export class MailProviderError extends ConvexError<string> {
  constructor(
    public status: number,
    message?: string,
  ) {
    super(
      message ??
        `Email service could not complete this request (${status}). Please try again or check your inbox.`,
    );
  }
}
export async function mailRequest(
  path: string,
  options: { method?: string; body?: unknown; key?: string; idempotencyKey?: string } = {},
) {
  const key = options.key ?? env.AGENTMAIL_API_KEY;
  if (!key) throw new ConvexError("Purchasing email is not configured.");
  const base = (env.AGENTMAIL_BASE_URL ?? "https://api.agentmail.to/v0").replace(/\/$/, "");
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) {
    const error = record(await response.json().catch(() => ({})));
    const message =
      error.code === "limit_exceeded" && error.resource === "domain"
        ? "Custom email domains are not available on the workspace’s current email plan. Contact BUY HARD support to enable domain capacity. Your existing email still works."
        : undefined;
    throw new MailProviderError(response.status, message);
  }
  return response.status === 204 ? {} : record(await response.json());
}
export async function inboxKey(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
  inboxId: string,
) {
  const credentials = await ctx.runQuery(internal.mailSettings.credentials, {
    organizationId,
    inboxId,
  });
  if (!credentials) return undefined; // Existing installations retain service access until restricted access is enabled.
  if (credentials.inboxId !== inboxId || credentials.state !== "ready" || !credentials.encryptedKey)
    throw new ConvexError("Company email access needs checking in settings.");
  if (!env.AGENTMAIL_CREDENTIAL_KEY)
    throw new ConvexError("Company email access is not configured.");
  const saved = record(await unseal(credentials.encryptedKey, env.AGENTMAIL_CREDENTIAL_KEY));
  if (!string(saved.apiKey)) throw new ConvexError("Company email access needs checking.");
  return string(saved.apiKey);
}
export async function companyInbox(ctx: ActionCtx, inboxId?: string) {
  const company = await ctx.runQuery(internal.companyMail.context, { inboxId });
  if (!company.email) throw new ConvexError("Connect your purchasing inbox first.");
  return {
    ...company,
    email: company.email,
    key: await inboxKey(ctx, company.organizationId, company.email),
  };
}
