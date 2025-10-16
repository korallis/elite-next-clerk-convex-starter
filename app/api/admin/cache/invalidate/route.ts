import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
