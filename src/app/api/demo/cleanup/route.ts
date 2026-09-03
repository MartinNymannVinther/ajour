import { NextResponse } from "next/server";
import { cleanupExpiredDemos, demoEnabled } from "@/modules/demo/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cleanup for an installation that would rather run it on a schedule than
 * rely on visits. It is safe to call from anywhere because it can only
 * delete demos that have already expired: there is nothing to protect and
 * nothing to leak, so it needs no secret.
 */
export async function POST() {
  if (!demoEnabled()) return new NextResponse("Not found", { status: 404 });
  const removed = await cleanupExpiredDemos();
  return NextResponse.json({ removed });
}
