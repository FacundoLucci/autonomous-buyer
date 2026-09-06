import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

// Existing items predate the archive flag. Both unset and false mean active.
export async function activeCompanyItems(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<"organizations">,
) {
  const pages = await Promise.all(
    [undefined, false].map((archived) =>
      ctx.db
        .query("inventoryItems")
        .withIndex("by_org_archived", (q) =>
          q.eq("organizationId", organizationId).eq("archived", archived),
        )
        .take(101),
    ),
  );
  return pages.flat().sort((a, b) => a.sku.localeCompare(b.sku));
}
