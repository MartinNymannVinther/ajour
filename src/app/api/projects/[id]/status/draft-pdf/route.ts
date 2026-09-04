import { requireOrgContext } from "@/core/auth/guard";
import { callerKey, rateLimit } from "@/core/rate-limit";
import { pdfFileName, serverReportWords } from "@/modules/reports/pdf-words";
import { buildDraftReport, parseAuthored } from "@/modules/reports/status-authoring";
import { renderStatusPdf } from "@/modules/reports/status-pdf";

/**
 * A PDF of the draft before it is approved, so a manager can read it the
 * way the steering group will, or send it for a look first. The report is
 * built here from the plan and the person's fields, exactly the way
 * approval builds it; the browser's own idea of the report is not used.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const context = await requireOrgContext();
  if (!context) return new Response("Unauthorized", { status: 401 });
  // Rendering a PDF costs real CPU; a script should not get to spend it.
  if (!rateLimit(callerKey(request.headers, `draft-pdf:${context.userId}`), 20, 60_000).allowed) {
    return new Response("Too many requests", { status: 429 });
  }
  const { id } = await params;
  const raw = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const input = parseAuthored({ ...(raw ?? {}), projectId: id });
  if (!input) return new Response("Bad request", { status: 400 });

  const report = await buildDraftReport(context, input);
  if (!report) return new Response("Not found", { status: 404 });

  const buffer = await renderStatusPdf(report, await serverReportWords(), true);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFileName(report.projectName, report.weekKey, true)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
