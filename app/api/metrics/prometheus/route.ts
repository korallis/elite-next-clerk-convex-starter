import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function GET() {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return new NextResponse("", { status: 401 });
  if (!orgId) return new NextResponse("", { status: 400 });
  if (String(orgRole || "").toLowerCase() !== "admin") return new NextResponse("", { status: 403 });

  const convex = getConvexClient();
  const since = Date.now() - DAY_MS;
  // Fetch audits for org and compute simple stats
  const listByOrg = (api as any).queryAudits?.listByOrg;
  const audits: any[] = listByOrg
    ? await convex.query(listByOrg, { adminToken: process.env.CONVEX_ADMIN_TOKEN!, orgId } as any)
    : [];
  const windowed = audits.filter((a) => a.createdAt >= since);
  const total = windowed.length;
  const errors = windowed.filter((a) => a.status === "error").length;
  const durations = windowed.filter((a) => a.status === "success" && typeof a.durationMs === "number").map((a) => a.durationMs as number);
  durations.sort((a, b) => a - b);
  const p = (q: number) => (durations.length ? durations[Math.min(durations.length - 1, Math.floor(q * (durations.length - 1)))] : 0);
  const p95 = p(0.95);

  const lines = [
    `# HELP leo_queries_total Number of NL→SQL or dashboard queries in last 24h`,
    `# TYPE leo_queries_total gauge`,
    `leo_queries_total{orgId="${orgId}"} ${total}`,
    `# HELP leo_errors_total Number of failed queries in last 24h`,
    `# TYPE leo_errors_total gauge`,
    `leo_errors_total{orgId="${orgId}"} ${errors}`,
    `# HELP leo_nl_p95_ms P95 duration (ms) for successful queries in last 24h`,
    `# TYPE leo_nl_p95_ms gauge`,
    `leo_nl_p95_ms{orgId="${orgId}"} ${p95}`,
  ];
  return new NextResponse(lines.join("\n") + "\n", { status: 200, headers: { "Content-Type": "text/plain; version=0.0.4" } });
}
