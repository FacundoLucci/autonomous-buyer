import { paginationOptsValidator } from "convex/server";
import { query } from "./_generated/server";
import { ownedCompany } from "./onboarding";

export const list = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const { organization } = await ownedCompany(ctx);
    return ctx.db
      .query("auditEntries")
      .withIndex("by_organizationId", (q) => q.eq("organizationId", organization._id))
      .order("desc")
      .paginate(args.paginationOpts);
  },
});
