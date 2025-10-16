import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!orgId) {
    return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  }

  try {
    const url = new URL(request.url);
    const daysParam = url.searchParams.get("days");
    const parsedDays = daysParam ? Number.parseInt(daysParam, 10) : undefined;
    const days = Number.isFinite(parsedDays) ? parsedDays : undefined;
    const convex = getConvexClient();
    const convexApi = api as any;
    const stakeholderQuery = convexApi.metrics?.stakeholder ?? (api as any).metrics?.stakeholder;
    if (!stakeholderQuery) {
      throw new Error("Stakeholder metrics query not generated");
    }
    const metrics = await convex.query(stakeholderQuery, {
      adminToken: process.env.CONVEX_ADMIN_TOKEN!,
      orgId,
      days,
    } as any);
    return NextResponse.json(metrics);
  } catch (error) {
    console.error("Failed to load stakeholder metrics", error);
    return NextResponse.json({ error: "Failed to load metrics" }, { status: 500 });
  }
}
