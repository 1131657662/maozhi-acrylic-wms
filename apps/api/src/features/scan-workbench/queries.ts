import {
  SCAN_CANDIDATE_PAGE_SIZE,
  SCAN_FRAGMENT_MIN,
  scanCandidatesSchema,
  scanSummarySchema,
  type ScanCandidateQuery,
  type Detail,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { decimalToGrams } from '../../db/weight.ts';
import { AppError } from '../../shared/errors.ts';
import { getOrder } from '../outbound/repository.ts';
import { catalogFrom, selectedLine } from './catalog.ts';

export async function scanCandidates(db: Database, id: string, query: ScanCandidateQuery) {
  return db.readSnapshot(async (tx) => {
    selectedLine(await getOrder(tx, id), query.productCode);
    const exact = await tx.get(`SELECT e.barcode ${catalogFrom} WHERE h.id=1 AND e.barcode=?`, [query.query]);
    if (!exact && query.query.length < SCAN_FRAGMENT_MIN)
      throw new AppError('SCAN_QUERY_SHORT', `请输入完整条码或至少 ${SCAN_FRAGMENT_MIN} 位片段`, 422);
    const from = `${catalogFrom} LEFT JOIN scan_facts f ON f.plan_id=? AND f.barcode=e.barcode`;
    const where = `WHERE h.id=1 AND (p.code IS NULL OR p.code=?) AND ${exact ? 'e.barcode=?' : "e.barcode LIKE ? ESCAPE '!'"}`;
    const args = [id, query.productCode, exact ? query.query : `%${query.query.replace(/[!%_]/g, '!$&')}%`];
    const total = Number((await tx.get(`SELECT COUNT(*) AS n ${from} ${where}`, args))?.n ?? 0);
    const rows = await tx.all(
      `SELECT e.barcode,e.source_spec,e.weight_tonnes,p.code AS mapped_code,f.id,f.revoked_at
      ${from} ${where} ORDER BY e.barcode LIMIT ? OFFSET ?`,
      [...args, SCAN_CANDIDATE_PAGE_SIZE, (query.page - 1) * SCAN_CANDIDATE_PAGE_SIZE],
    );
    return scanCandidatesSchema.parse({
      total,
      page: query.page,
      pageSize: SCAN_CANDIDATE_PAGE_SIZE,
      items: rows.map((r) => ({
        barcode: r.barcode,
        sourceSpec: r.source_spec,
        weightGrams: decimalToGrams(r.weight_tonnes),
        status: r.revoked_at ? 'revoked' : r.id ? 'recorded' : 'available',
        attribution: r.mapped_code ? 'catalog' : 'manual',
      })),
    });
  });
}
function totals(lines: Detail['lines'], facts: Detail['facts']) {
  const planned = {
    packages: lines.reduce((s, l) => s + l.plannedPackages, 0),
    weightGrams: lines.reduce((s, l) => s + l.plannedWeightGrams, 0),
  };
  const recorded = { packages: facts.length, weightGrams: facts.reduce((s, f) => s + f.weightGrams, 0) };
  return {
    planned,
    recorded,
    difference: {
      packages: planned.packages - recorded.packages,
      weightGrams: planned.weightGrams - recorded.weightGrams,
    },
  };
}
export async function scanSummary(db: Database, id: string) {
  const order = await getOrder(db, id);
  const products = [...new Set(order.lines.map((l) => l.productCode))].map((productCode) => {
    const lines = order.lines.filter((l) => l.productCode === productCode);
    return {
      productCode,
      productName: lines[0]!.productName,
      ...totals(
        lines,
        order.facts.filter((f) => f.productCode === productCode),
      ),
    };
  });
  return scanSummarySchema.parse({ ...totals(order.lines, order.facts), products });
}
