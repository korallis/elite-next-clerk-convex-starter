import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAdminToken } from "./utils/adminAuth";

export const get = query({
  args: { adminToken: v.string(), orgId: v.string() },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const doc = await ctx.db.query("orgSettings").withIndex("byOrg", (q) => q.eq("orgId", args.orgId)).first();
    if (!doc) return null;
    try {
      return { ...doc, settings: JSON.parse(doc.settings) } as any;
    } catch {
      return { ...doc, settings: {} } as any;
    }
  },
});

export const upsert = mutation({
  args: { adminToken: v.string(), orgId: v.string(), settingsJson: v.string() },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const existing = await ctx.db.query("orgSettings").withIndex("byOrg", (q) => q.eq("orgId", args.orgId)).first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { settings: args.settingsJson, updatedAt: now });
      return existing._id;
    }
    return ctx.db.insert("orgSettings", { orgId: args.orgId, settings: args.settingsJson, updatedAt: now });
  },
});
