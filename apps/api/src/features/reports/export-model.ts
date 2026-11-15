import type { ReportKind, ReportMeta, DerivedReportMeta, ReportView } from '@wms/contracts';

export interface ReportExportModel {
  kind: ReportKind;
  rows: Record<string, unknown>[];
  report: ReportMeta | DerivedReportMeta;
  view: ReportView;
}
