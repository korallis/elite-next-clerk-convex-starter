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
      selectedTables: v.optional(v.array(v.string())),
      excludedTables: v.optional(v.array(v.string())),
      selectionMode: v.optional(
        v.union(v.literal("all"), v.literal("include"), v.literal("exclude"))
      ),
      syncRequestedAt: v.optional(v.number()),
    })
      .index("byOrg", ["orgId"])
      .index("byOrgAndName", ["orgId", "name"]),

    orgConnectionDrafts: defineTable({
      orgId: v.string(),
      createdBy: v.string(),
      name: v.optional(v.string()),
      step: v.number(),
      encryptedConfig: v.optional(encryptedPayloadValidator),
      selectedTables: v.optional(v.array(v.string())),
      selectionMode: v.optional(
        v.union(v.literal("all"), v.literal("include"), v.literal("exclude"))
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("byOrg", ["orgId"])
      .index("byOrgAndUser", ["orgId", "createdBy"]),

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
      status: v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed")
      ),
      startedAt: v.number(),
      completedAt: v.optional(v.number()),
      error: v.optional(v.string()),
      attempts: v.optional(v.number()),
    })
      .index("byOrg", ["orgId"])
      .index("byConnection", ["connectionId"])
      .index("byStatus", ["status"]),

    semanticSyncStages: defineTable({
      runId: v.id("semanticSyncRuns"),
      stage: v.string(),
      status: v.union(
        v.literal("pending"),
        v.literal("running"),
        v.literal("completed"),
        v.literal("failed")
      ),
      startedAt: v.optional(v.number()),
      completedAt: v.optional(v.number()),
      error: v.optional(v.string()),
      // Store metrics as JSON string for compatibility
      metrics: v.optional(v.string()),
    })
      .index("byRun", ["runId"])
      .index("byRunStage", ["runId", "stage"]),

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
      .index("byOrgCreatedAt", ["orgId", "createdAt"])
      .index("byOrgAndQuestion", ["orgId", "question"]),

    dashboards: defineTable({
      orgId: v.string(),
      name: v.string(),
      createdBy: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    }).index("byOrg", ["orgId"]),

    dashboardTiles: defineTable({
      orgId: v.string(),
      dashboardId: v.id("dashboards"),
      connectionId: v.optional(v.id("orgConnections")),
      title: v.string(),
      sql: v.string(),
      chartSpec: v.string(),
      order: v.number(),
      // layout metadata
      x: v.optional(v.number()),
      y: v.optional(v.number()),
      w: v.optional(v.number()),
      h: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("byDashboard", ["dashboardId"]) 
      .index("byOrg", ["orgId"]),
    
  });