import { ConvexError } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";

export async function readBuyerSession(ctx: QueryCtx | MutationCtx, id: Id<"buyerSessions">) {
  const session = await ctx.db.get("buyerSessions", id);
  const user = session ? await ctx.db.get("users", session.userId) : null;
  if (
    !session ||
    !user?.isActive ||
    user.isAnonymous ||
    user.organizationId !== session.organizationId ||
    !["admin", "buyer"].includes(user.role ?? "")
  )
    throw new ConvexError("Conversation unavailable.");
  return { session, user };
}

export async function finishBuyerTask(
  ctx: MutationCtx,
  chat: Doc<"taskChats">,
  summary?: string,
  error?: string,
) {
  if (!chat.buyerSessionId) return;
  const session = await ctx.db.get("buyerSessions", chat.buyerSessionId);
  if (
    !session ||
    session.activeChatId !== chat._id ||
    (chat.currentMessageId && session.currentMessageId !== chat.currentMessageId)
  )
    return;
  await ctx.db.patch("buyerSessions", session._id, {
    busy: false,
    latestText: summary ?? session.latestText,
    error,
    ...(chat.savedAt && chat.resultId
      ? {
          focus:
            chat.task === "new_buy" ||
            chat.task === "buy" ||
            chat.task === "confirm" ||
            chat.task === "receive"
              ? { page: "buys" as const, buy: chat.resultId }
              : chat.task === "settings"
                ? { page: "settings" as const }
                : { page: "inventory" as const, item: chat.resultId },
        }
      : {}),
    updatedAt: Date.now(),
  });
}
