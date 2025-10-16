import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST() {
  const { userId, orgRole } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (String(orgRole || "").toLowerCase() !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  try {
    // @ts-ignore
    if (global.__TILE_CACHE__ && typeof global.__TILE_CACHE__.clear === "function") {
      // @ts-ignore
      global.__TILE_CACHE__.clear();
    }
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: "Failed to invalidate cache" }, { status: 500 });
  }
}
