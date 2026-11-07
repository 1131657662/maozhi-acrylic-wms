import type { Database } from '../../db/mysql.ts';
import type { FactInput,Detail } from '@wms/contracts';
import { getOrder } from '../outbound/repository.ts';
import { ensure } from '../../shared/errors.ts';
import { hash } from '../../shared/hash.ts';
import { audit,type Actor } from '../../shared/audit.ts';
import { lockPlan } from '../../shared/command.ts';
import { gramsToDecimal } from '../../db/weight.ts';
import { sqlDate } from '../../db/dates.ts';
import { validateFact } from './validate.ts';

interface ScanCommand { planId:string;fact:FactInput;actor:Actor }
async function insertFact(db: Database, command: ScanCommand, payloadHash:string): Promise<void> {
  const {planId,fact,actor}=command;
  await db.run(`INSERT INTO scan_facts(id,plan_id,barcode,weight_tonnes,catalog_version,weight_source,
    device_id,scanned_at,received_at,recorded_by,payload_hash) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    [fact.id,planId,fact.barcode,gramsToDecimal(fact.weightGrams),fact.catalogVersion,fact.weightSource,
    fact.deviceId,sqlDate(fact.scannedAt),sqlDate(new Date().toISOString()),actor.username,payloadHash]);
}
export async function recordFact(db: Database, command: ScanCommand): Promise<Detail> {
  return db.transaction(async (tx) => {
    const {planId,fact,actor}=command;
    await lockPlan(tx,planId);
    await tx.get('SELECT barcode FROM scan_catalog WHERE barcode=? FOR UPDATE',[fact.barcode]);
    const payloadHash=hash(JSON.stringify({planId,fact}));
    const existing=await tx.get('SELECT payload_hash FROM scan_facts WHERE id=?',[fact.id]);
    if(existing) {
      ensure(existing.payload_hash===payloadHash,'IDEMPOTENCY_CONFLICT','事实 ID 已使用且正文不同');
      return getOrder(tx,planId);
    }
    const plan=await getOrder(tx,planId);
    await validateFact(tx,plan,fact);
    await insertFact(tx,command,payloadHash);
    await tx.run('UPDATE outbound_orders SET revision=revision+1 WHERE id=?',[planId]);
    await audit(tx,actor,{action:'scan.record',targetId:planId,before:{revision:plan.revision},after:fact});
    return getOrder(tx,planId);
  });
}
