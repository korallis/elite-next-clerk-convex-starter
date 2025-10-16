import { query } from "./_generated/server";
import { v } from "convex/values";
import { computeStakeholderMetrics } from "./_shared/metrics/stakeholder";
import { assertAdminToken } from "./utils/adminAuth";

export const stakeholder = query({
  args: {
    adminToken: v.string(),
    orgId: v.string(),
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const [connections, audits, dashboards, tiles] = await Promise.all([
      ctx.db.query("orgConnections").withIndex("byOrg", (q) => q.eq("orgId", args.orgId)).collect(),
      ctx.db
        .query("queryAudits")
        .withIndex("byOrg", (q) => q.eq("orgId", args.orgId))
        .collect(),
      ctx.db.query("dashboards").withIndex("byOrg", (q) => q.eq("orgId", args.orgId)).collect(),
      ctx.db.query("dashboardTiles").withIndex("byOrg", (q) => q.eq("orgId", args.orgId)).collect(),
    ]);
    return computeStakeholderMetrics({
      days: args.days,
      connections,
      audits,
      dashboards,
      tiles,
    });
  },
});
