import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

export async function POST(request: Request) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  if (String(orgRole || "").toLowerCase() !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => ({}));
  const olderThanDays = Number.isFinite(body?.olderThanDays) ? Number(body.olderThanDays) : undefined;
  const convex = getConvexClient();
  const result = await convex.mutation((api as any).retention.run, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
    olderThanDays,
  } as any);
  return NextResponse.json({ success: true, ...result });
}
