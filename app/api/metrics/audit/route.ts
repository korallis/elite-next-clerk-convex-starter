import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getConvexClient } from "@/lib/convexServerClient";
import { api } from "@/convex/_generated/api";

export async function GET(request: NextRequest) {
  const { userId, orgId, orgRole } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  if (String(orgRole || "").toLowerCase() !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const url = new URL(request.url);
  const connectionId = url.searchParams.get("connectionId") || undefined;
  const status = url.searchParams.get("status") || undefined; // success | error
  const user = url.searchParams.get("user") || undefined;
  const from = url.searchParams.get("from") ? Number(url.searchParams.get("from")) : undefined;
  const to = url.searchParams.get("to") ? Number(url.searchParams.get("to")) : undefined;
  const format = (url.searchParams.get("format") || "json").toLowerCase();

  try {
    const convex = getConvexClient();
    const convexApi = api as any;
    const listByOrg = convexApi.queryAudits?.listByOrg;
    if (!listByOrg) throw new Error("queryAudits.listByOrg not available");
    const docs = await convex.query(listByOrg, {
      adminToken: process.env.CONVEX_ADMIN_TOKEN!,
      orgId,
    } as any);

    const filtered = (docs as any[])
      .filter((d) => (connectionId ? String(d.connectionId) === connectionId : true))
      .filter((d) => (status ? d.status === status : true))
      .filter((d) => (user ? d.userId === user : true))
      .filter((d) => (typeof from === "number" ? d.createdAt >= from : true))
      .filter((d) => (typeof to === "number" ? d.createdAt <= to : true))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 1000);

    if (format === "csv") {
      const header = ["createdAt","userId","connectionId","question","sql","rowCount","durationMs","status","error"].join(",");
      const rows = filtered.map((d) => [
        new Date(d.createdAt).toISOString(),
        safe(mask(d.userId)),
        safe(String(d.connectionId)),
        csvEsc(mask(d.question)),
        csvEsc(mask(d.sql)),
        String(d.rowCount ?? 0),
        String(d.durationMs ?? 0),
        safe(d.status),
        csvEsc(mask(d.error || "")),
      ].join(","));
      const csv = [header, ...rows].join("\n");
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="audit_${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({ audits: filtered });
  } catch (error) {
    return NextResponse.json({ error: "Failed to load audits" }, { status: 500 });
  }
}

function csvEsc(s: string): string {
  if (s == null) return "";
  const t = String(s).replace(/"/g, '""');
  if (/[",\n]/.test(t)) return `"${t}"`;
  return t;
}

function safe(s: unknown): string {
  return s == null ? "" : String(s);
}

function mask(s: string): string {
  if (!s) return s;
  // Basic masking for potential secrets/tokens/long strings
  return s.replace(/[A-Za-z0-9_\-]{24,}/g, (m) => `${m.slice(0, 4)}…${m.slice(-4)}`);
}
