import type { Database } from '../../db/mysql.ts';
import { z } from 'zod';
import type { Detail, ListQuery } from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';
import { assembleOrders } from './assemble.ts';
import { correctionSummary } from '../corrections/summary.ts';
import { headerSql, lineSql, factSql, headerSchema, rawLineSchema, rawFactSchema } from './rows.ts';

async function assemble(db: Database, headers: z.infer<typeof headerSchema>[]): Promise<Detail[]> {
  if (!headers.length) return [];
  const ids = headers.map((row) => row.id);
  const slots = ids.map(() => '?').join(',');
  const lines = z
    .array(rawLineSchema)
    .parse(
      await db.all(`${lineSql} WHERE order_id IN (${slots}) AND source_del_flag=0 ORDER BY line_position,id`, ids),
    );
  const facts = z.array(rawFactSchema).parse(await db.all(`${factSql} WHERE plan_id IN (${slots}) ORDER BY id`, ids));
  const contexts = z.array(z.object({ factId: z.string(), lineId: z.string() })).parse(
    await db.all(
      `SELECT c.fact_id AS factId,c.outbound_line_id AS lineId FROM scan_fact_context c
      JOIN scan_facts f ON f.id=c.fact_id WHERE f.plan_id IN (${slots})`,
      ids,
    ),
  );
  return assembleOrders(headers, { lines, facts, products: new Map(contexts.map((row) => [row.factId, row.lineId])) });
}
export async function getOrder(db: Database, id: string): Promise<Detail> {
  return db.transaction(async (tx) => {
    const row = await tx.get(`${headerSql} WHERE id=? AND source_del_flag=0`, [id]);
    if (!row) throw new AppError('NOT_FOUND', '出库计划不存在', 404);
    const detail = (await assemble(tx, [headerSchema.parse(row)]))[0];
    if (!detail) throw new AppError('NOT_FOUND', '出库计划不存在', 404);
    const source = await tx.get('SELECT source_id FROM outbound_orders WHERE id=?', [id]);
    return {
      ...detail,
      corrections: await correctionSummary(tx, {
        kind: 'outbound',
        id,
        eligible: source?.source_id === null && detail.status === 'confirmed',
        lines: detail.lines.map((l) => ({
          id: l.id,
          productCode: l.productCode,
          productName: l.productName,
          packages: l.actualPackages,
          weightGrams: l.actualWeightGrams,
        })),
      }),
    };
  });
}
export async function listOrders(db: Database, query: ListQuery) {
  return db.transaction(async (tx) => {
    const predicates = ['source_del_flag=0', "order_no LIKE ? ESCAPE '!'"];
    const params: (string | number)[] = [query.keyword.replace(/[!%_]/g, '!$&') + '%'];
    if (query.status) {
      predicates.push('status=?');
      params.push(query.status);
    }
    const where = predicates.join(' AND ');
    const total = Number(
      (await tx.get(`SELECT COUNT(*) AS total FROM outbound_orders WHERE ${where}`, params))?.total ?? 0,
    );
    const rows = await tx.all(`${headerSql} WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`, [
      ...params,
      query.pageSize,
      (query.page - 1) * query.pageSize,
    ]);
    return {
      items: await assemble(tx, z.array(headerSchema).parse(rows)),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  });
}
