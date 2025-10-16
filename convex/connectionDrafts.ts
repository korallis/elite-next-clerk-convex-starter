import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAdminToken } from "./utils/adminAuth";

const selectionModeValidator = v.union(
  v.literal("all"),
  v.literal("include"),
  v.literal("exclude")
);

export const get = query({
  args: {
    adminToken: v.string(),
    draftId: v.id("orgConnectionDrafts"),
    orgId: v.string(),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const draft = await ctx.db.get(args.draftId);
    if (!draft || draft.orgId !== args.orgId) {
      return null;
    }
    return draft;
  },
});

export const getActiveForUser = query({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    userId: v.string(),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const drafts = await ctx.db
      .query("orgConnectionDrafts")
      .withIndex("byOrgAndUser", (q) =>
        q.eq("orgId", args.orgId).eq("createdBy", args.userId)
      )
      .collect();
    if (drafts.length === 0) return null;
    return drafts.sort((a, b) => b.updatedAt - a.updatedAt)[0];
  },
});

export const save = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    userId: v.string(),
    draftId: v.optional(v.id("orgConnectionDrafts")),
    name: v.optional(v.string()),
    step: v.optional(v.number()),
    encryptedConfig: v.optional(
      v.object({
        algorithm: v.string(),
        iv: v.string(),
        ciphertext: v.string(),
        tag: v.string(),
      })
    ),
    selectedTables: v.optional(v.array(v.string())),
    selectionMode: v.optional(selectionModeValidator),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);

    const now = Date.now();
    const normalizeTables = (tables?: string[] | null) => {
      if (!tables || tables.length === 0) return undefined;
      const seen = new Set<string>();
      const normalized: string[] = [];
      for (const table of tables) {
        const trimmed = table.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        normalized.push(trimmed);
      }
      return normalized;
    };

    if (args.draftId) {
      const existing = await ctx.db.get(args.draftId);
      if (!existing || existing.orgId !== args.orgId || existing.createdBy !== args.userId) {
        throw new Error("Draft not found");
      }
      await ctx.db.patch(args.draftId, {
        name: args.name ?? existing.name,
        step: args.step ?? existing.step,
        encryptedConfig: args.encryptedConfig ?? existing.encryptedConfig,
        selectedTables: normalizeTables(args.selectedTables) ?? existing.selectedTables,
        selectionMode: args.selectionMode ?? existing.selectionMode,
        updatedAt: now,
      });
      return args.draftId;
    }

    const draftId = await ctx.db.insert("orgConnectionDrafts", {
      orgId: args.orgId,
      createdBy: args.userId,
      name: args.name,
      step: args.step ?? 1,
      encryptedConfig: args.encryptedConfig,
      selectedTables: normalizeTables(args.selectedTables),
      selectionMode: args.selectionMode,
      createdAt: now,
      updatedAt: now,
    });
    return draftId;
  },
});

export const remove = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    userId: v.string(),
    draftId: v.id("orgConnectionDrafts"),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const existing = await ctx.db.get(args.draftId);
    if (!existing || existing.orgId !== args.orgId || existing.createdBy !== args.userId) {
      return;
    }
    await ctx.db.delete(args.draftId);
  },
});
