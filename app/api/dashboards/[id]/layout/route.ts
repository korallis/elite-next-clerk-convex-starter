import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

type Body = {
  updates: Array<{ tileId: string; order?: number; w?: number; h?: number; x?: number; y?: number }>;
};

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  if (typeof orgRole === "string" && orgRole.toLowerCase() === "viewer") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.updates) || body.updates.length === 0) {
    return NextResponse.json({ error: "updates required" }, { status: 422 });
  }

  const convex = getConvexClient();
  await convex.mutation(api.dashboards.updateTileLayout, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
    updates: body.updates.map((u) => ({
      tileId: u.tileId as any,
      order: typeof u.order === "number" ? u.order : undefined,
      w: typeof u.w === "number" ? u.w : undefined,
      h: typeof u.h === "number" ? u.h : undefined,
      x: typeof u.x === "number" ? u.x : undefined,
      y: typeof u.y === "number" ? u.y : undefined,
    })),
  });

  return NextResponse.json({ success: true });
}
