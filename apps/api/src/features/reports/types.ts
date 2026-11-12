import type { ReportDetailRow, ReportMonthlyRow, ReportQuery, ReportMeta } from '@wms/contracts';
import type { ReportSnapshot } from './snapshot.ts';
export interface Period {
  key: string;
  start: string;
  end: string;
}
export interface LedgerEvent extends ReportDetailRow {
  sequence: number;
  localTime: string | null;
  deleted: boolean;
  historical: boolean;
  family: 'inbound' | 'outbound' | 'manual' | 'count' | 'import' | 'correction' | 'unknown';
  reverse: boolean;
}
export interface Cell {
  warehouseCode: string;
  warehouseName: string;
  productCode: string;
  productName: string;
  periods: Map<string, ReportMonthlyRow>;
  previous?: LedgerEvent;
  lastHistorical?: LedgerEvent;
  auditTail?: LedgerEvent;
  auditHistoricalTail?: LedgerEvent;
  hasLaterEvents?: boolean;
  firstTime: string | null;
  missingTime: boolean;
  boundaries: Map<string, { opening?: string; closing?: string }>;
  events?: LedgerEvent[];
  snapshotPackages?: number | null;
  snapshotGrams?: number | null;
}
export interface Projection {
  snapshot: ReportSnapshot;
  cells: Map<string, Cell>;
  periods: Period[];
  metadata: ReportMeta;
  monthly: ReportMonthlyRow[];
  digest: string;
  detailTotal: number;
  chronological: boolean;
}
export type ReportReadQuery = Omit<ReportQuery, 'pageSize'> & { pageSize: number };
