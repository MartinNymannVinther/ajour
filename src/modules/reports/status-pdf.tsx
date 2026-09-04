import { Document, Page, renderToBuffer } from "@react-pdf/renderer";
import { PdfAppendix } from "./pdf-appendix";
import { PdfFront } from "./pdf-front";
import { ensureFonts, styles } from "./pdf-styles";
import type { StatusReport } from "./status-report";
import type { ReportWords } from "./words";

/**
 * The week's status as a document that can be sent on. Two pages by
 * design: the front for the people who decide, the appendix for the
 * people who ask. It renders from the frozen report, so a status reads
 * next year exactly as it did the day it was approved, and it is rendered
 * on demand rather than written to disk: nothing to back up, nothing to
 * leak, nothing left behind when a workspace is deleted.
 *
 * No figure is ever cut by a page edge: every chart sits in a view that
 * moves whole to the next page when it does not fit.
 */
function StatusDocument({
  report,
  words,
  draft,
}: {
  report: StatusReport;
  words: ReportWords;
  draft: boolean;
}) {
  return (
    <Document title={`${report.projectName} · ${words.week(report.weekKey)}`} author="Ajour">
      <Page size="A4" style={styles.page}>
        <PdfFront report={report} words={words} draft={draft} />
      </Page>
      <Page size="A4" style={styles.page}>
        <PdfAppendix report={report} words={words} />
      </Page>
    </Document>
  );
}

export function renderStatusPdf(
  report: StatusReport,
  words: ReportWords,
  draft = false,
): Promise<Buffer> {
  ensureFonts();
  return renderToBuffer(<StatusDocument report={report} words={words} draft={draft} />);
}
