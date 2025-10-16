import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAdminToken } from "./utils/adminAuth";

export const list = query({
  args: { adminToken: v.string(), orgId: v.string() },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const docs = await ctx.db.query("prompts").withIndex("byOrg", (q) => q.eq("orgId", args.orgId)).collect();
    return docs.sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

export const upsert = mutation({
  args: { adminToken: v.string(), orgId: v.string(), key: v.string(), text: v.string(), version: v.number() },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const existing = await ctx.db.query("prompts").withIndex("byOrgAndKey", (q) => q.eq("orgId", args.orgId).eq("key", args.key)).first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { text: args.text, version: args.version, updatedAt: now });
      return existing._id;
    }
    return ctx.db.insert("prompts", { orgId: args.orgId, key: args.key, text: args.text, version: args.version, updatedAt: now });
  },
});
