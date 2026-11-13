import type { CatalogBarcodeTraceResult } from '@wms/contracts';
import type { StatusTagType } from '../../components/ui/StatusTag';
import { catalogQueryCopy } from './query-copy';
import { candidateCopy } from './candidate-copy';

type CatalogVersionStatus = CatalogBarcodeTraceResult['versions'][number]['status'];

const weightFormatter = new Intl.NumberFormat('zh-CN', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export function formatCatalogWeight(weightGrams: number): string {
  return `${weightFormatter.format(weightGrams / 1000)} ${catalogQueryCopy.kilogram}`;
}

export function catalogStatusPresentation(status: CatalogVersionStatus): { label: string; tone: StatusTagType } {
  if (status === 'abandoned') return { label: candidateCopy.abandoned, tone: 'warning' };
  return status === 'published'
    ? { label: catalogQueryCopy.published, tone: 'success' }
    : { label: catalogQueryCopy.validated, tone: 'default' };
}
