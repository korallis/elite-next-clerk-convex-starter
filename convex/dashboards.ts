import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAdminToken } from "./utils/adminAuth";

export const create = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    name: v.string(),
    createdBy: v.string(),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const now = Date.now();
    const id = await ctx.db.insert("dashboards", {
      orgId: args.orgId,
      name: args.name,
      createdBy: args.createdBy,
      createdAt: now,
      updatedAt: now,
    });
    return id;
  },
});

export const list = query({
  args: { adminToken: v.string(), orgId: v.string() },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    return ctx.db.query("dashboards").withIndex("byOrg", (q) => q.eq("orgId", args.orgId)).collect();
  },
});

export const addTile = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    dashboardId: v.id("dashboards"),
    connectionId: v.optional(v.id("orgConnections")),
    title: v.string(),
    sql: v.string(),
    chartSpecJson: v.string(),
    order: v.number(),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const now = Date.now();
    await ctx.db.insert("dashboardTiles", {
      orgId: args.orgId,
      dashboardId: args.dashboardId,
      connectionId: args.connectionId,
      title: args.title,
      sql: args.sql,
      chartSpec: args.chartSpecJson,
      order: args.order,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getTiles = query({
  args: { adminToken: v.string(), orgId: v.string(), dashboardId: v.id("dashboards") },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const tiles = await ctx.db
      .query("dashboardTiles")
      .withIndex("byDashboard", (q) => q.eq("dashboardId", args.dashboardId))
      .collect();
    return tiles.filter((t) => t.orgId === args.orgId).sort((a, b) => a.order - b.order);
  },
});

export const deleteTile = mutation({
  args: { adminToken: v.string(), orgId: v.string(), tileId: v.id("dashboardTiles") },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const tile = await ctx.db.get(args.tileId);
    if (!tile || tile.orgId !== args.orgId) throw new Error("Not found");
    await ctx.db.delete(args.tileId);
  },
});
