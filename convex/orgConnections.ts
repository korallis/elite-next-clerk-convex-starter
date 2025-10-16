import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { connectionConfigSchema, type ConnectionConfig } from "./validators/connection";
import { assertAdminToken } from "./utils/adminAuth";

const selectionModeValidator = v.union(
  v.literal("all"),
  v.literal("include"),
  v.literal("exclude")
);

function normalizeTables(tables?: string[] | null) {
  if (!tables || tables.length === 0) {
    return undefined;
  }
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const value of tables) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }
  return normalized;
}

export const list = query({
  args: { adminToken: v.string(), orgId: v.string() },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const docs = await ctx.db
      .query("orgConnections")
      .withIndex("byOrg", (q) => q.eq("orgId", args.orgId))
      .collect();
    return docs.map(({ encryptedConfig: _encryptedConfig, ...rest }) => rest);
  },
});

export const get = query({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    connectionId: v.id("orgConnections"),
    includeEncrypted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const doc = await ctx.db.get(args.connectionId);
    if (!doc || doc.orgId !== args.orgId) {
      return null;
    }
    const { encryptedConfig, ...rest } = doc;
    if (args.includeEncrypted) {
      return { ...rest, encryptedConfig };
    }
    return rest;
  },
});

export const create = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    name: v.string(),
    driver: v.literal("mssql"),
    encryptedConfig: v.object({
      algorithm: v.string(),
      iv: v.string(),
      ciphertext: v.string(),
      tag: v.string(),
    }),
    createdBy: v.string(),
    selectedTables: v.optional(v.array(v.string())),
    excludedTables: v.optional(v.array(v.string())),
    selectionMode: v.optional(selectionModeValidator),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const existing = await ctx.db
      .query("orgConnections")
      .withIndex("byOrgAndName", (q) => q.eq("orgId", args.orgId).eq("name", args.name))
      .first();
    if (existing) {
      throw new Error("A data source with this name already exists");
    }
    const connectionId = await ctx.db.insert("orgConnections", {
      orgId: args.orgId,
      name: args.name,
      driver: args.driver,
      encryptedConfig: args.encryptedConfig,
      createdBy: args.createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastVerifiedAt: undefined,
      lastError: undefined,
      selectedTables: normalizeTables(args.selectedTables),
      excludedTables: normalizeTables(args.excludedTables),
      selectionMode: args.selectionMode ?? "all",
      syncRequestedAt: undefined,
    });
    const inserted = await ctx.db.get(connectionId);
    if (!inserted) {
      throw new Error("Failed to persist connection");
    }
    const { encryptedConfig: _encryptedConfig, ...rest } = inserted;
    return { id: connectionId, ...rest };
  },
});

export const updateVerification = mutation({
  args: {
    adminToken: v.string(),
    connectionId: v.id("orgConnections"),
    orgId: v.string(),
    lastVerifiedAt: v.optional(v.number()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const doc = await ctx.db.get(args.connectionId);
    if (!doc || doc.orgId !== args.orgId) {
      throw new Error("Connection not found");
    }
    await ctx.db.patch(args.connectionId, {
      lastVerifiedAt: args.lastVerifiedAt,
      lastError: args.lastError,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    connectionId: v.id("orgConnections"),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const doc = await ctx.db.get(args.connectionId);
    if (!doc || doc.orgId !== args.orgId) {
      throw new Error("Connection not found");
    }
    await ctx.db.delete(args.connectionId);
  },
});

export const markSyncRequested = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    connectionId: v.id("orgConnections"),
    requestedAt: v.number(),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const doc = await ctx.db.get(args.connectionId);
    if (!doc || doc.orgId !== args.orgId) {
      throw new Error("Connection not found");
    }
    await ctx.db.patch(args.connectionId, {
      syncRequestedAt: args.requestedAt,
      updatedAt: Date.now(),
    });
  },
});
