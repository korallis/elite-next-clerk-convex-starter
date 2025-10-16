import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAdminToken } from "./utils/adminAuth";

export const listByRun = query({
  args: {
    adminToken: v.string(),
    runId: v.id("semanticSyncRuns"),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    return ctx.db
      .query("semanticSyncStages")
      .withIndex("byRun", (q) => q.eq("runId", args.runId))
      .collect();
  },
});

export const upsert = mutation({
  args: {
    adminToken: v.string(),
    runId: v.id("semanticSyncRuns"),
    stage: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("running"),
      v.literal("completed"),
      v.literal("failed")
    ),
    error: v.optional(v.string()),
    metrics: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const existing = await ctx.db
      .query("semanticSyncStages")
      .withIndex("byRunStage", (q) => q.eq("runId", args.runId).eq("stage", args.stage))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        error: args.error,
        metrics: args.metrics,
        startedAt: existing.startedAt ?? (args.status === "running" ? now : undefined),
        completedAt: args.status === "completed" || args.status === "failed" ? now : existing.completedAt,
      });
      return existing._id;
    }
    return ctx.db.insert("semanticSyncStages", {
      runId: args.runId,
      stage: args.stage,
      status: args.status,
      error: args.error,
      metrics: args.metrics,
      startedAt: args.status === "running" ? now : undefined,
      completedAt: args.status === "completed" || args.status === "failed" ? now : undefined,
    });
  },
});
