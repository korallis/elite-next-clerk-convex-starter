import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });

  const url = new URL(request.url);
  const daysParam = url.searchParams.get("days");
  const days = Math.min(Math.max(Number.parseInt(daysParam || "14", 10) || 14, 7), 90);

  const end = Date.now();
  const start = end - days * DAY_MS;

  const convex = getConvexClient();
  const listByOrg = (api as any).queryAudits?.listByOrg;
  if (!listByOrg) return NextResponse.json({ error: "queryAudits.listByOrg not available" }, { status: 500 });
  const audits = (await convex.query(listByOrg, {
    adminToken: process.env.CONVEX_ADMIN_TOKEN!,
    orgId,
  } as any)) as any[];

  const byDay: Record<string, { total: number; errors: number }> = {};
  for (let i = 0; i < days; i++) {
    const d = new Date(start + i * DAY_MS);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    byDay[key] = { total: 0, errors: 0 };
  }
  for (const a of audits) {
    if (a.createdAt < start || a.createdAt >= end) continue;
    const d = new Date(a.createdAt);
    d.setHours(0, 0, 0, 0);
    const key = d.toISOString().slice(0, 10);
    const bucket = byDay[key];
    if (!bucket) continue;
    bucket.total += 1;
    if (a.status === "error") bucket.errors += 1;
  }

  const limit = parseInt(process.env.ORG_DAILY_QUERY_LIMIT || "500", 10);
  const series = Object.entries(byDay).map(([date, v]) => ({ date, total: v.total, errors: v.errors, limit }));

  return NextResponse.json({ days, series, limit });
}
