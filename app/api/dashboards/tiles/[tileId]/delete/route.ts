import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

export async function POST(_: Request, { params }: { params: { tileId: string } }) {
  const { userId, orgId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  const convex = getConvexClient();
  await convex.mutation(api.dashboards.deleteTile, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
    tileId: params.tileId as any,
  });
  return NextResponse.json({ success: true });
}
