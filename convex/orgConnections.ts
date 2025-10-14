import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { connectionConfigSchema, type ConnectionConfig } from "./validators/connection";
import { encryptJson, decryptJson } from "./utils/encryption";
import { assertAdminToken } from "./utils/adminAuth";

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
    includeConfig: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const doc = await ctx.db.get(args.connectionId);
    if (!doc || doc.orgId !== args.orgId) {
      return null;
    }
    const { encryptedConfig: encrypted, ...rest } = doc;
    if (!args.includeConfig) {
      return rest;
    }
    const config = decryptJson<ConnectionConfig>(encrypted);
    return { ...rest, config };
  },
});

export const create = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    name: v.string(),
    driver: v.literal("mssql"),
    configJson: v.string(),
    createdBy: v.string(),
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

    const parsedConfig = connectionConfigSchema.parse(JSON.parse(args.configJson));
    const encryptedConfig = encryptJson(parsedConfig);
    const connectionId = await ctx.db.insert("orgConnections", {
      orgId: args.orgId,
      name: args.name,
      driver: args.driver,
      encryptedConfig,
      createdBy: args.createdBy,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      lastVerifiedAt: undefined,
      lastError: undefined,
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
