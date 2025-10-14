import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

export async function GET(request: Request) {
  const { userId, orgId } = auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  const url = new URL(request.url);
  const connectionId = url.searchParams.get("connectionId");
  if (!connectionId) return NextResponse.json({ error: "connectionId required" }, { status: 422 });
  const convex = getConvexClient();
  const artifacts = await convex.query(api.semanticArtifacts.listByConnection, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
    connectionId: connectionId as any,
  });
  return NextResponse.json({ artifacts });
}
