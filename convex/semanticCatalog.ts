import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAdminToken } from "./utils/adminAuth";

export const upsertEntity = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    connectionId: v.id("orgConnections"),
    key: v.string(),
    name: v.string(),
    defaultTable: v.string(),
    idColumn: v.optional(v.string()),
    synonyms: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const existing = await ctx.db
      .query("semanticEntities")
      .withIndex("byConnectionAndKey", (q) => q.eq("connectionId", args.connectionId).eq("key", args.key))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        name: args.name,
        defaultTable: args.defaultTable,
        idColumn: args.idColumn,
        synonyms: args.synonyms,
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert("semanticEntities", {
      orgId: args.orgId,
      connectionId: args.connectionId,
      key: args.key,
      name: args.name,
      defaultTable: args.defaultTable,
      idColumn: args.idColumn,
      synonyms: args.synonyms,
      updatedAt: now,
    });
  },
});

export const upsertAttribute = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    connectionId: v.id("orgConnections"),
    entityKey: v.string(),
    name: v.string(),
    sourceTable: v.string(),
    sourceColumn: v.string(),
    join: v.optional(v.string()),
    synonyms: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const existing = await ctx.db
      .query("semanticAttributes")
      .withIndex("byEntity", (q) => q.eq("entityKey", args.entityKey))
      .filter((q) => q.eq(q.field("name"), args.name))
      .first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        sourceTable: args.sourceTable,
        sourceColumn: args.sourceColumn,
        join: args.join,
        synonyms: args.synonyms,
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert("semanticAttributes", {
      orgId: args.orgId,
      connectionId: args.connectionId,
      entityKey: args.entityKey,
      name: args.name,
      sourceTable: args.sourceTable,
      sourceColumn: args.sourceColumn,
      join: args.join,
      synonyms: args.synonyms,
      updatedAt: now,
    });
  },
});

export const upsertGraphEdge = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    connectionId: v.id("orgConnections"),
    sourceTable: v.string(),
    sourceColumn: v.string(),
    targetTable: v.string(),
    targetColumn: v.string(),
    kind: v.string(),
    weight: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const now = Date.now();
    const existing = await ctx.db
      .query("semanticGraphEdges")
      .withIndex("byTables", (q) => q.eq("sourceTable", args.sourceTable).eq("targetTable", args.targetTable))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        sourceColumn: args.sourceColumn,
        targetColumn: args.targetColumn,
        kind: args.kind,
        weight: args.weight,
        updatedAt: now,
      });
      return existing._id;
    }
    return ctx.db.insert("semanticGraphEdges", {
      orgId: args.orgId,
      connectionId: args.connectionId,
      sourceTable: args.sourceTable,
      sourceColumn: args.sourceColumn,
      targetTable: args.targetTable,
      targetColumn: args.targetColumn,
      kind: args.kind,
      weight: args.weight,
      updatedAt: now,
    });
  },
});

export const upsertOverride = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    connectionId: v.id("orgConnections"),
    kind: v.string(),
    target: v.string(),
    payloadJson: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const now = Date.now();
    return ctx.db.insert("semanticOverrides", {
      orgId: args.orgId,
      connectionId: args.connectionId,
      kind: args.kind,
      target: args.target,
      payload: args.payloadJson,
      updatedAt: now,
    });
  },
});

export const listCatalog = query({
  args: { adminToken: v.string(), orgId: v.string(), connectionId: v.id("orgConnections") },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const [entities, attributes, edges, overrides] = await Promise.all([
      ctx.db.query("semanticEntities").withIndex("byConnection", (q) => q.eq("connectionId", args.connectionId)).collect(),
      ctx.db.query("semanticAttributes").withIndex("byConnection", (q) => q.eq("connectionId", args.connectionId)).collect(),
      ctx.db.query("semanticGraphEdges").withIndex("byConnection", (q) => q.eq("connectionId", args.connectionId)).collect(),
      ctx.db.query("semanticOverrides").withIndex("byConnection", (q) => q.eq("connectionId", args.connectionId)).collect(),
    ]);
    return { entities, attributes, edges, overrides };
  },
});
