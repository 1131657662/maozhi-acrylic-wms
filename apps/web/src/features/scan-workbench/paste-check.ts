import { SCAN_BATCH_LIMIT } from '@wms/contracts';
import { fetchCandidates } from './keys';
import { text } from './copy';
import { ApiError } from '../../api/errors';

export interface PasteRow {
  barcode: string;
  productCode: string;
  state: 'valid' | 'duplicate' | 'invalid' | 'saved' | 'failed';
  reason: string;
}
export async function checkPaste(
  id: string,
  input: string,
  productCode: string,
  previous: PasteRow[],
): Promise<PasteRow[]> {
  const barcodes = input
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (barcodes.length + previous.length > SCAN_BATCH_LIMIT) throw new Error(text.limit(SCAN_BATCH_LIMIT));
  const seen = new Set(previous.map((r) => r.barcode));
  const rows: PasteRow[] = [];
  for (const barcode of barcodes) {
    if (seen.has(barcode)) {
      rows.push({ barcode, productCode, state: 'duplicate', reason: text.repeated });
      continue;
    }
    seen.add(barcode);
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(barcode)) {
      rows.push({ barcode, productCode, state: 'invalid', reason: text.bad });
      continue;
    }
    const candidates = await fetchCandidates(id, { query: barcode, productCode, page: 1 }).catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 422) return { items: [] };
      throw error;
    });
    const found = candidates.items.find((r) => r.barcode === barcode);
    rows.push({
      barcode,
      productCode,
      state: !found ? 'invalid' : found.status === 'available' ? 'valid' : 'duplicate',
      reason: !found ? text.missing : found.status === 'available' ? text.valid : text.repeated,
    });
  }
  return rows;
}
