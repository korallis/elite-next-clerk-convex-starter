import { v } from "convex/values";
import { query } from "./_generated/server";
import { assertAdminToken } from "./utils/adminAuth";

export const getTile = query({
  args: { adminToken: v.string(), tileId: v.id("dashboardTiles") },
  handler: async (ctx, args) => {
    assertAdminToken(ctx, args.adminToken);
    const tile = await ctx.db.get(args.tileId);
    return tile;
  },
});
