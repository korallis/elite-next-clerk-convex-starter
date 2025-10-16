import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

export async function GET(request: Request) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").toLowerCase();
  const connectionId = url.searchParams.get("connectionId");
  if (!q) return NextResponse.json({ results: [] });
  if (!connectionId) return NextResponse.json({ error: "connectionId is required" }, { status: 422 });

  const convex = getConvexClient();
  const artifacts = await convex.query(api.semanticArtifacts.listByConnection, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
    connectionId: connectionId as any,
  });
  const results = artifacts
    .filter((a: any) => a.orgId === orgId)
    .filter((a: any) => {
      const hay = `${a.artifactKey} ${JSON.stringify(a.payload || {})}`.toLowerCase();
      return hay.includes(q);
    })
    .slice(0, 50)
    .map((a: any) => ({
      id: a._id,
      type: a.artifactType,
      key: a.artifactKey,
      payload: a.payload,
    }));
  return NextResponse.json({ results });
}
