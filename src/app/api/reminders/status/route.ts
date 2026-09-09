import { NextResponse } from "next/server";
import { schedulerAllowed, sendStatusReminders } from "@/modules/reports/reminder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The weekly status reminder, for a scheduler that would rather call an
 * endpoint than run a script. Guarded by CRON_SECRET as a bearer token;
 * without the secret set the endpoint does not exist, and the script
 * (scripts/remind-status.ts) is the way to run it.
 */
export async function POST(request: Request) {
  if (!schedulerAllowed(request.headers.get("authorization")))
    return new NextResponse("Not found", { status: 404 });
  const outcome = await sendStatusReminders();
  return NextResponse.json(outcome);
}
