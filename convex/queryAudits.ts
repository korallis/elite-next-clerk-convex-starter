import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAdminToken } from "./utils/adminAuth";

export const record = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    connectionId: v.id("orgConnections"),
    userId: v.string(),
    question: v.string(),
    sql: v.string(),
    rowCount: v.number(),
    durationMs: v.number(),
    status: v.union(v.literal("success"), v.literal("error")),
    error: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    await ctx.db.insert("queryAudits", {
      orgId: args.orgId,
      connectionId: args.connectionId,
      userId: args.userId,
      question: args.question,
      sql: args.sql,
      rowCount: args.rowCount,
      durationMs: args.durationMs,
      status: args.status,
      error: args.error,
      createdAt: Date.now(),
    });
  },
});

export const countRecentByOrg = query({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const since = Date.now() - args.windowMs;
    const docs = await ctx.db
      .query("queryAudits")
      .withIndex("byOrgCreatedAt", (q) => q.eq("orgId", args.orgId))
      .collect();
    return docs.filter((d) => d.createdAt >= since).length;
  },
});

export const countRecentErrorsByOrg = query({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    windowMs: v.number(),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const since = Date.now() - args.windowMs;
    const docs = await ctx.db
      .query("queryAudits")
      .withIndex("byOrgCreatedAt", (q) => q.eq("orgId", args.orgId))
      .collect();
    return docs.filter((d) => d.createdAt >= since && d.status === "error").length;
  },
});
