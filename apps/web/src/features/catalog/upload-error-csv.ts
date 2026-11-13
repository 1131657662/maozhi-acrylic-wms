import { catalogExportCopy, type CatalogUploadErrors } from '@wms/contracts';

function csvCell(value: string | number): string {
  const text = String(value);
  const safe = /^\s*[=+\-@\t\r\n]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function uploadErrorCsv(report: CatalogUploadErrors): string {
  const rows = [
    [catalogExportCopy.line, catalogExportCopy.raw, catalogExportCopy.reason],
    ...report.errors.map((error) => [error.line, error.raw, error.reason]),
  ];
  return '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}
