import { NextResponse, type NextRequest } from "next/server";
import { callerKey, rateLimit } from "@/core/rate-limit";
import {
  createDemoWorkspace,
  demoCookieSecure,
  demoEnabled,
  demoLandingUrl,
} from "@/modules/demo/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The front door for someone who wants to try Ajour without asking for an
 * account. It builds a workspace, seeds a half-finished project, signs the
 * visitor in and sends them to it.
 *
 * A GET that creates something is unusual, and deliberate: the point is a
 * link somebody can put on a website. What it creates is throwaway, so
 * the usual reason not to — a crawler triggering it — costs a row that
 * expires within the day, and the rate limit keeps that bounded.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  if (!demoEnabled()) return new NextResponse("Not found", { status: 404 });

  const limit = rateLimit(callerKey(request.headers, "demo"), 5, 60 * 60 * 1000);
  if (!limit.allowed)
    return new NextResponse("Too many demo workspaces from this address. Try again later.", {
      status: 429,
      headers: { "Retry-After": String(limit.retryAfterSeconds) },
    });

  const { locale } = await params;
  const language = locale === "en" ? "en" : "da";
  const demo = await createDemoWorkspace(language);
  if (!demo) return new NextResponse("The demo is not available right now.", { status: 503 });

  // Both the destination and the cookie's Secure flag come from the
  // installation's public origin, not from the request: behind the proxy
  // the request only knows the container's own address.
  const response = NextResponse.redirect(demoLandingUrl(language, demo.projectId), {
    status: 303,
  });
  // The sign-up call answered with the session cookie; hand it on.
  for (const cookie of demo.headers.get("cookie")?.split("; ") ?? []) {
    const [name, ...rest] = cookie.split("=");
    if (name && rest.length)
      response.cookies.set(name, rest.join("="), {
        httpOnly: true,
        sameSite: "lax",
        secure: demoCookieSecure(),
        path: "/",
      });
  }
  return response;
}
