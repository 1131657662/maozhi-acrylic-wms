import type { Database } from '../../db/mysql.ts';
import { z } from 'zod';
import type { Detail,ListQuery } from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';
import { assembleOrders } from './assemble.ts';
import { headerSql,lineSql,factSql,headerSchema,rawLineSchema,rawFactSchema } from './rows.ts';

async function assemble(db: Database, headers: z.infer<typeof headerSchema>[]): Promise<Detail[]> {
  if (!headers.length) return [];
  const ids = headers.map((row)=>row.id);
  const slots = ids.map(()=>'?').join(',');
  const lines = z.array(rawLineSchema).parse(await db.all(`${lineSql} WHERE order_id IN (${slots}) AND source_del_flag=0 ORDER BY product_code`,ids));
  const facts = z.array(rawFactSchema).parse(await db.all(`${factSql} WHERE plan_id IN (${slots}) ORDER BY id`,ids));
  const catalog = z.array(z.object({barcode:z.string(),productCode:z.string()})).parse(
    await db.all(`SELECT barcode,product_code AS productCode FROM scan_catalog WHERE barcode IN
      (SELECT barcode FROM scan_facts WHERE plan_id IN (${slots}))`,ids));
  return assembleOrders(headers,{lines,facts,products:new Map(catalog.map((row)=>[row.barcode,row.productCode]))});
}
export async function getOrder(db: Database, id: string): Promise<Detail> {
  return db.transaction(async (tx) => {
    const row = await tx.get(`${headerSql} WHERE id=? AND source_del_flag=0`,[id]);
    if (!row) throw new AppError('NOT_FOUND','出库计划不存在',404);
    const detail = (await assemble(tx,[headerSchema.parse(row)]))[0];
    if (!detail) throw new AppError('NOT_FOUND','出库计划不存在',404);
    return detail;
  });
}
export async function listOrders(db: Database, query: ListQuery) {
  return db.transaction(async (tx) => {
    const predicates = ["source_del_flag=0", "order_no LIKE ? ESCAPE '!'"];
    const params: (string|number)[] = [query.keyword.replace(/[!%_]/g,'!$&')+'%'];
    if(query.status) { predicates.push('status=?'); params.push(query.status); }
    const where = predicates.join(' AND ');
    const total = Number((await tx.get(`SELECT COUNT(*) AS total FROM outbound_orders WHERE ${where}`,params))?.total ?? 0);
    const rows = await tx.all(`${headerSql} WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`,
      [...params,query.pageSize,(query.page-1)*query.pageSize]);
    return {items:await assemble(tx,z.array(headerSchema).parse(rows)),total,page:query.page,pageSize:query.pageSize};
  });
}
