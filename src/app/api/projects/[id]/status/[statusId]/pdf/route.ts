import { and, eq } from "drizzle-orm";
import { requireOrgContext } from "@/core/auth/guard";
import { statusUpdates } from "@/core/db/schema";
import { withOrgContext } from "@/core/db/tenant";
import { pdfFileName, serverReportWords } from "@/modules/reports/pdf-words";
import { parseStatusReport } from "@/modules/reports/status-report";
import { renderStatusPdf } from "@/modules/reports/status-pdf";

/**
 * The status as a PDF, rendered when it is asked for. Nothing is stored:
 * the frozen report is the document, so there is no file to back up, no
 * file to leak, and no file left behind when a workspace is deleted.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; statusId: string }> },
) {
  const context = await requireOrgContext();
  if (!context) return new Response("Unauthorized", { status: 401 });
  const { id, statusId } = await params;

  const row = await withOrgContext(context, async (tx) => {
    const [found] = await tx
      .select()
      .from(statusUpdates)
      .where(and(eq(statusUpdates.id, statusId), eq(statusUpdates.projectId, id)))
      .limit(1);
    return found ?? null;
  });
  if (!row) return new Response("Not found", { status: 404 });
  const report = parseStatusReport(row.details);
  if (!report) return new Response("Not found", { status: 404 });

  const buffer = await renderStatusPdf(report, await serverReportWords());
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdfFileName(report.projectName, report.weekKey)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
