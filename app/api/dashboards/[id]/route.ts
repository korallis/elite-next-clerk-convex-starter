import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

export async function GET(_: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });

  const convex = getConvexClient();
  const tiles = await convex.query(api.dashboards.getTiles, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
    dashboardId: id as any,
  });
  // Attach lastRefreshedAt using query audits with question key per tile
  const results = await Promise.all(
    tiles.map(async (t: any) => {
      const q = `DASHBOARD_TILE:${t._id}`;
      try {
        const last = await convex.query((api as any).queryAudits.lastForQuestion, {
          adminToken: process.env.CONVEX_ADMIN_TOKEN!,
          orgId,
          question: q,
        });
        return { ...t, lastRefreshedAt: last?.createdAt ?? null };
      } catch {
        return { ...t, lastRefreshedAt: null };
      }
    })
  );
  return NextResponse.json({ tiles: results });
}
