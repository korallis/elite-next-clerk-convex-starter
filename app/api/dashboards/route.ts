import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

export async function GET() {
  const { userId, orgId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  const convex = getConvexClient();
  const dashboards = await convex.query(api.dashboards.list, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
  });
  return NextResponse.json({ dashboards });
}

export async function POST(request: Request) {
  const { userId, orgId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  const body = (await request.json()) as { name: string };
  if (!body?.name) return NextResponse.json({ error: "name required" }, { status: 422 });
  const convex = getConvexClient();
  const id = await convex.mutation(api.dashboards.create, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
    name: body.name,
    createdBy: userId,
  });
  return NextResponse.json({ id });
}
