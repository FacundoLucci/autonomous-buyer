import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
export async function activeInbox(ctx: Pick<QueryCtx, "db">, organizationId: Id<"organizations">) {
  return ctx.db
    .query("purchasingInboxes")
    .withIndex("by_organization_and_provider", (q) =>
      q.eq("organizationId", organizationId).eq("provider", "agentmail"),
    )
    .unique();
}
export async function findInbox(ctx: Pick<QueryCtx, "db">, inboxId: string) {
  return (
    (await ctx.db
      .query("purchasingInboxes")
      .withIndex("by_inbox_id", (q) => q.eq("inboxId", inboxId))
      .unique()) ??
    (await ctx.db
      .query("mailInboxHistory")
      .withIndex("by_inboxId", (q) => q.eq("inboxId", inboxId))
      .unique())
  );
}
// Older purchases predate explicit sender tracking. Their sender is the original inbox.
export async function conversationInbox(
  ctx: Pick<QueryCtx, "db">,
  organizationId: Id<"organizations">,
  inboxId?: string,
) {
  const inbox = inboxId
    ? await findInbox(ctx, inboxId)
    : ((await ctx.db
        .query("mailInboxHistory")
        .withIndex("by_organizationId", (q) => q.eq("organizationId", organizationId))
        .first()) ?? (await activeInbox(ctx, organizationId)));
  return inbox?.organizationId === organizationId ? inbox : null;
}
