import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

export async function GET(_: Request, { params }: { params: { id: string } }) {
  const { userId, orgId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });

  const convex = getConvexClient();
  const tiles = await convex.query(api.dashboards.getTiles, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
    dashboardId: params.id as any,
  });
  return NextResponse.json({ tiles });
}
