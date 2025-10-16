import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { assertAdminToken } from "./utils/adminAuth";

export const run = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    olderThanDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const days = Math.max(30, Math.floor(args.olderThanDays ?? 730)); // default 24 months
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

    const audits = await ctx.db
      .query("queryAudits")
      .withIndex("byOrgCreatedAt", (q) => q.eq("orgId", args.orgId))
      .collect();

    let archived = 0;
    for (const a of audits) {
      if (a.createdAt >= cutoff) continue;
      await ctx.db.insert("auditArchives", {
        orgId: a.orgId,
        connectionId: a.connectionId,
        createdAt: a.createdAt,
        archivedAt: Date.now(),
        doc: JSON.stringify({
          userId: a.userId,
          question: a.question,
          sql: a.sql,
          rowCount: a.rowCount,
          durationMs: a.durationMs,
          status: a.status,
          error: a.error ?? null,
        }),
      });
      await ctx.db.delete(a._id);
      archived++;
    }

    return { archived };
  },
});
