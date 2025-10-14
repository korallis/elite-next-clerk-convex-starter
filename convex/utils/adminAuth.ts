import type { MutationCtx, QueryCtx } from "../_generated/server";

export function assertAdminToken(
  _ctx: QueryCtx | MutationCtx,
  token: string
) {
  const expected = process.env.CONVEX_ADMIN_TOKEN;
  if (!expected) {
    throw new Error("CONVEX_ADMIN_TOKEN environment variable is not set");
  }
  if (token !== expected) {
    throw new Error("Unauthorized");
  }
}
