import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

type Body = {
  dashboardId?: string;
  newDashboardName?: string;
  connectionId?: string;
  title: string;
  sql: string;
  chartSpec: unknown;
};

export async function POST(request: Request) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  if (typeof orgRole === "string" && orgRole.toLowerCase() === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await request.json()) as Body;
  if (!body?.title || !body?.sql) return NextResponse.json({ error: "title and sql required" }, { status: 422 });

  const convex = getConvexClient();
  let dashboardId = body.dashboardId as any;
  if (!dashboardId) {
    if (!body.newDashboardName) return NextResponse.json({ error: "newDashboardName required if dashboardId missing" }, { status: 422 });
    dashboardId = await convex.mutation(api.dashboards.create, {
      adminToken: process.env.CONVEX_ADMIN_TOKEN!,
      orgId,
      name: body.newDashboardName,
      createdBy: userId,
    });
  }

  await convex.mutation(api.dashboards.addTile, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
    dashboardId,
    connectionId: (body.connectionId as any) ?? undefined,
    title: body.title,
    sql: body.sql,
    chartSpecJson: JSON.stringify(body.chartSpec ?? { type: "table" }),
    order: Date.now(),
  });

  return NextResponse.json({ success: true, dashboardId });
}
