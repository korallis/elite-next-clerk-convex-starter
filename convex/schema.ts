import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { paymentAttemptSchemaValidator } from "./paymentAttemptTypes";

const encryptedPayloadValidator = v.object({
  algorithm: v.string(),
  ciphertext: v.string(),
  iv: v.string(),
  tag: v.string(),
});

export default defineSchema({
    users: defineTable({
      name: v.string(),
      // this the Clerk ID, stored in the subject JWT field
      externalId: v.string(),
    }).index("byExternalId", ["externalId"]),
    
    paymentAttempts: defineTable(paymentAttemptSchemaValidator)
      .index("byPaymentId", ["payment_id"])
      .index("byUserId", ["userId"])
      .index("byPayerUserId", ["payer.user_id"]),

    orgConnections: defineTable({
      orgId: v.string(),
      name: v.string(),
      driver: v.literal("mssql"),
      encryptedConfig: encryptedPayloadValidator,
      createdBy: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
      lastVerifiedAt: v.optional(v.number()),
      lastError: v.optional(v.string()),
    })
      .index("byOrg", ["orgId"])
      .index("byOrgAndName", ["orgId", "name"]),

    semanticArtifacts: defineTable({
      orgId: v.string(),
      connectionId: v.id("orgConnections"),
      artifactType: v.string(),
      artifactKey: v.string(),
      version: v.number(),
      payload: v.string(),
      embeddingId: v.optional(v.string()),
      updatedAt: v.number(),
    })
      .index("byOrg", ["orgId"])
      .index("byConnection", ["connectionId"])
      .index("byConnectionAndKey", ["connectionId", "artifactKey"]),

    semanticSyncRuns: defineTable({
      orgId: v.string(),
      connectionId: v.id("orgConnections"),
      status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed")),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
      error: v.optional(v.string()),
    })
      .index("byOrg", ["orgId"])
      .index("byConnection", ["connectionId"])
      .index("byStatus", ["status"]),

    queryAudits: defineTable({
      orgId: v.string(),
      connectionId: v.id("orgConnections"),
      userId: v.string(),
      question: v.string(),
      sql: v.string(),
      rowCount: v.number(),
      durationMs: v.number(),
      createdAt: v.number(),
      status: v.union(v.literal("success"), v.literal("error")),
      error: v.optional(v.string()),
    })
      .index("byOrg", ["orgId"])
      .index("byConnection", ["connectionId"])
      .index("byOrgCreatedAt", ["orgId", "createdAt"]),
  });