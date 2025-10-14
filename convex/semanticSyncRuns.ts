import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAdminToken } from "./utils/adminAuth";

export const create = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    connectionId: v.id("orgConnections"),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    return ctx.db.insert("semanticSyncRuns", {
      orgId: args.orgId,
      connectionId: args.connectionId,
      status: "running",
      startedAt: Date.now(),
      completedAt: undefined,
      error: undefined,
    });
  },
});

export const complete = mutation({
  args: {
    adminToken: v.string(),
    runId: v.id("semanticSyncRuns"),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    await ctx.db.patch(args.runId, {
      status: "completed",
      completedAt: Date.now(),
      error: undefined,
    });
  },
});

export const fail = mutation({
  args: {
    adminToken: v.string(),
    runId: v.id("semanticSyncRuns"),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    await ctx.db.patch(args.runId, {
      status: "failed",
      completedAt: Date.now(),
      error: args.error,
    });
  },
});

export const listRecent = query({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    connectionId: v.id("orgConnections"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const limit = args.limit ?? 10;
    const runs = await ctx.db
      .query("semanticSyncRuns")
      .withIndex("byConnection", (q) => q.eq("connectionId", args.connectionId))
      .collect();
    return runs
      .filter((run) => run.orgId === args.orgId)
      .sort((a, b) => b.startedAt - a.startedAt)
      .slice(0, limit);
  },
});
