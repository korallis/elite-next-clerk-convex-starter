import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getOrgSettings, setOrgSettings } from "@/lib/convexServerClient";

export async function GET() {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  const settings = (await getOrgSettings(orgId)) ?? {};
  return NextResponse.json({ settings });
}

export async function POST(request: NextRequest) {
  const { userId, orgId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!orgId) return NextResponse.json({ error: "Organization is required" }, { status: 400 });
  const body = await request.json().catch(() => ({}));
  const rateLimitDaily = Number.isFinite(body?.rateLimitDaily) ? Number(body.rateLimitDaily) : undefined;
  const errorWindowLimit = Number.isFinite(body?.errorWindowLimit) ? Number(body.errorWindowLimit) : undefined;
  const next = { ...(await getOrgSettings(orgId)), ...(rateLimitDaily ? { rateLimitDaily } : {}), ...(errorWindowLimit ? { errorWindowLimit } : {}) };
  await setOrgSettings(orgId, next);
  return NextResponse.json({ settings: next });
}
