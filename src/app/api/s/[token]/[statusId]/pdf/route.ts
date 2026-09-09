import { todayInCopenhagen } from "@/core/dates";
import { callerKey, rateLimit } from "@/core/rate-limit";
import { pdfFileName, serverReportWords } from "@/modules/reports/pdf-words";
import { renderStatusPdf } from "@/modules/reports/status-pdf";
import { readSharedProject } from "@/modules/share/service";

/**
 * At most this many public PDF renders at a time, across the whole
 * process. The number is small on purpose: react-pdf holds the whole
 * document in memory while it draws, and this endpoint has no session to
 * hold anybody responsible.
 */
const MAX_CONCURRENT_RENDERS = 3;
let rendering = 0;

function takeRenderSlot(): { release: () => void } | null {
  if (rendering >= MAX_CONCURRENT_RENDERS) return null;
  rendering += 1;
  let released = false;
  return {
    release() {
      if (released) return;
      released = true;
      rendering -= 1;
    },
  };
}

/**
 * The status as a PDF from a share link: the same public report the share
 * page shows, with money, obstacles and what management was asked for
 * left out, rendered on demand. One address is enough for a steering
 * group.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string; statusId: string }> },
) {
  if (!rateLimit(callerKey(request.headers, "share-pdf"), 30, 60_000).allowed) {
    return new Response("Too many requests", { status: 429 });
  }
  const { token, statusId } = await params;
  const shared = await readSharedProject(token, todayInCopenhagen());
  if (!shared) return new Response("Not found", { status: 404 });
  const status = shared.statuses.find((s) => s.id === statusId);
  if (!status?.report) return new Response("Not found", { status: 404 });

  // Rendering a PDF is the most expensive thing this installation will do
  // for somebody with no session. The rate limit counts requests per
  // address; this counts renders in flight, so a handful of addresses
  // asking at once cannot take the process down between them.
  const slot = takeRenderSlot();
  if (!slot) return new Response("Busy, try again in a moment", { status: 503 });
  let buffer: Buffer;
  try {
    buffer = await renderStatusPdf(status.report, await serverReportWords());
  } finally {
    slot.release();
  }
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFileName(shared.name, status.weekKey)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
