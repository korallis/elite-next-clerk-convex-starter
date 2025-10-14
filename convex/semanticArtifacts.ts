import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { assertAdminToken } from "./utils/adminAuth";

export const listByConnection = query({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    connectionId: v.id("orgConnections"),
    artifactType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const artifacts = await ctx.db
      .query("semanticArtifacts")
      .withIndex("byConnection", (q) => q.eq("connectionId", args.connectionId))
      .collect();
    return artifacts
      .filter((artifact) => artifact.orgId === args.orgId)
      .filter((artifact) =>
        args.artifactType ? artifact.artifactType === args.artifactType : true
      )
      .map(({ payload, ...rest }) => ({ ...rest, payload: JSON.parse(payload) }));
  },
});

export const upsert = mutation({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    connectionId: v.id("orgConnections"),
    artifactType: v.string(),
    artifactKey: v.string(),
    version: v.number(),
    payloadJson: v.string(),
    embeddingId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const existing = await ctx.db
      .query("semanticArtifacts")
      .withIndex("byConnectionAndKey", (q) =>
        q.eq("connectionId", args.connectionId).eq("artifactKey", args.artifactKey)
      )
      .first();

    const now = Date.now();
    if (existing) {
      if (existing.orgId !== args.orgId) {
        throw new Error("Artifact org mismatch");
      }
      await ctx.db.patch(existing._id, {
        artifactType: args.artifactType,
        version: args.version,
        payload: args.payloadJson,
        embeddingId: args.embeddingId,
        updatedAt: now,
      });
      return existing._id;
    }

    return ctx.db.insert("semanticArtifacts", {
      orgId: args.orgId,
      connectionId: args.connectionId,
      artifactType: args.artifactType,
      artifactKey: args.artifactKey,
      version: args.version,
      payload: args.payloadJson,
      embeddingId: args.embeddingId,
      updatedAt: now,
    });
  },
});
