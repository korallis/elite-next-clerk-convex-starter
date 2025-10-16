import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

export async function GET() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  if (String(orgRole || "").toLowerCase() !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const convex = getConvexClient();
  const items = await convex.query((api as any).risks.list, { adminToken: process.env.CONVEX_ADMIN_TOKEN!, orgId } as any);
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  if (String(orgRole || "").toLowerCase() !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const convex = getConvexClient();
  const id = await convex.mutation((api as any).risks.upsert, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
    id: body?.id,
    title: body?.title,
    owner: body?.owner,
    probability: Number(body?.probability ?? 0),
    impact: Number(body?.impact ?? 0),
    status: body?.status ?? "open",
    trigger: body?.trigger,
    mitigation: body?.mitigation,
  } as any);
  return NextResponse.json({ id });
}
