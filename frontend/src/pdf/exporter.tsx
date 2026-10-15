import { pdf } from '@react-pdf/renderer';
import ReceiptTemplate from './templates/Receipt';
import ReportTemplate from './templates/Report';
import TaxSummaryTemplate from './templates/TaxSummary';

export type PdfExportType = 'receipt' | 'report' | 'tax-summary';

export interface PdfExportResult {
  blob: Blob;
  url: string;
  fileName: string;
}

interface PdfExportInput {
  type: PdfExportType;
  data: Record<string, unknown>;
  mode: 'preview' | 'download';
}

const buildFileName = (type: PdfExportType) => {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `${type}-${stamp}.pdf`;
};

export const exportPdf = async ({ type, data }: PdfExportInput): Promise<PdfExportResult> => {
  const templateMap = {
    receipt: <ReceiptTemplate data={data} />,
    report: <ReportTemplate data={data} />,
    'tax-summary': <TaxSummaryTemplate data={data} />,
  };

  const doc = templateMap[type];
  const blob = await pdf(doc).toBlob();
  const url = URL.createObjectURL(blob);
  const fileName = buildFileName(type);

  return { blob, url, fileName };
};
