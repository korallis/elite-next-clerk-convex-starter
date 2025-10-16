import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAdminToken } from "./utils/adminAuth";

export const list = query({
  args: { adminToken: v.string(), orgId: v.string() },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const docs = await ctx.db.query("risks").withIndex("byOrg", (q) => q.eq("orgId", args.orgId)).collect();
    return docs.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0));
  },
});

export const upsert = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    id: v.optional(v.id("risks")),
    title: v.string(),
    owner: v.string(),
    probability: v.number(),
    impact: v.number(),
    status: v.string(),
    trigger: v.optional(v.string()),
    mitigation: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const now = Date.now();
    if (args.id) {
      await ctx.db.patch(args.id, {
        title: args.title,
        owner: args.owner,
        probability: args.probability,
        impact: args.impact,
        status: args.status,
        trigger: args.trigger,
        mitigation: args.mitigation,
        updatedAt: now,
      });
      return args.id;
    }
    return ctx.db.insert("risks", {
      orgId: args.orgId,
      title: args.title,
      owner: args.owner,
      probability: args.probability,
      impact: args.impact,
      status: args.status,
      trigger: args.trigger,
      mitigation: args.mitigation,
      updatedAt: now,
    });
  },
});
