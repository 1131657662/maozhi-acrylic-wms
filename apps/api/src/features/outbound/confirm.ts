import type { Database } from '../../db/mysql.ts';
import type { Detail } from '@wms/contracts';
import { gramsToDecimal } from '../../db/weight.ts';
import { sqlDate } from '../../db/dates.ts';
import { getOrder } from './repository.ts';
import { ensure } from '../../shared/errors.ts';
import { audit } from '../../shared/audit.ts';
import { replay,saveResult,checkRevision,lockPlan,type PlanCommand } from '../../shared/command.ts';

async function deductStock(db: Database, plan: Detail): Promise<void> {
  for (const line of plan.lines) {
    const weight = gramsToDecimal(line.actualWeightGrams);
    const result = await db.run(`UPDATE stock SET packages=packages-?,weight_tonnes=weight_tonnes-?
      WHERE warehouse_code=? AND product_code=? AND packages>=? AND weight_tonnes>=?`,
      [line.actualPackages,weight,plan.warehouseCode,line.productCode,line.actualPackages,weight]);
    ensure(result.changes===1,'INSUFFICIENT_STOCK','库存包数或实重不足，确认未执行');
    await db.run(`INSERT INTO stock_journal(order_id,warehouse_code,product_code,packages_delta,tonnes_delta,created_at)
      VALUES(?,?,?,?,?,?)`,[plan.id,plan.warehouseCode,line.productCode,-line.actualPackages,
      gramsToDecimal(-line.actualWeightGrams),sqlDate(new Date().toISOString())]);
  }
}
export async function confirmOutbound(db: Database, command: PlanCommand): Promise<Detail> {
  return db.transaction(async (tx) => {
    await lockPlan(tx,command.planId);
    const previous = await replay(tx,'confirm',command);
    if(previous) return previous;
    const before = await getOrder(tx,command.planId);
    checkRevision(before,command.expected);
    ensure(before.status==='frozen','NOT_FROZEN','只能确认已冻结的扫码计划');
    const submission = await tx.get('SELECT digest FROM scan_submissions WHERE plan_id=?',[before.id]);
    ensure(submission?.digest===before.digest,'DIGEST_MISMATCH','冻结摘要与当前事实不一致');
    await deductStock(tx,before);
    await tx.run("UPDATE outbound_orders SET status='confirmed',revision=revision+1 WHERE id=?",[before.id]);
    const after = await getOrder(tx,before.id);
    await audit(tx,command.actor,{action:'outbound.confirm',targetId:before.id,before,after});
    await saveResult(tx,{scope:'confirm',command},after);
    return after;
  });
}
