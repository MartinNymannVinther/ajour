import { todayInCopenhagen } from "@/core/dates";
import { callerKey, rateLimit } from "@/core/rate-limit";
import { pdfFileName, serverReportWords } from "@/modules/reports/pdf-words";
import { renderStatusPdf } from "@/modules/reports/status-pdf";
import { readSharedProject } from "@/modules/share/service";

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

  const buffer = await renderStatusPdf(status.report, await serverReportWords());
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFileName(shared.name, status.weekKey)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
