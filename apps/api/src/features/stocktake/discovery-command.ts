import { randomUUID } from 'node:crypto';
import {
  createDiscoverySchema,
  updateDiscoverySchema,
  deleteDiscoverySchema,
  discoverySchema,
  discoveryDeletedSchema,
  discoveryCopy,
  type CreateDiscovery,
  type UpdateDiscovery,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { ensure } from '../../shared/errors.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
import { lockInventoryWriter } from '../inventory/operation.ts';
import { lockCounting } from './window.ts';
import { discovery, discoverySelect } from './discovery-read.ts';
import { validateNewDiscovery, validateDiscoveryProduct } from './discovery-validation.ts';

interface Command {
  id: string;
  lineId?: string;
  input: unknown;
  key: string;
  actor: Actor;
}
async function current(db: Database, id: string, lineId: string) {
  const row = await db.get(`${discoverySelect} WHERE d.stocktake_id=? AND d.id=?`, [id, lineId]);
  ensure(row, 'DISCOVERY_NOT_FOUND', discoveryCopy.missing);
  return discovery(row);
}
async function changed(db: Database, command: Command, action: string, before: unknown, after: unknown) {
  await db.run('UPDATE stocktakes SET revision=revision+1 WHERE id=?', [command.id]);
  await audit(db, command.actor, { action, targetId: command.id, before, after });
}
async function insert(db: Database, command: Command, input: CreateDiscovery, warehouse: string) {
  const lineId = randomUUID();
  await validateNewDiscovery(db, command.id, warehouse, input.productCode);
  await db.run(
    `INSERT INTO stocktake_discovery_lines
    (id,stocktake_id,warehouse_code,product_code,packages,weight_grams,reason,actor,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`,
    [
      lineId,
      command.id,
      warehouse,
      input.productCode,
      input.packages,
      input.weightGrams,
      input.reason,
      command.actor.username,
    ],
  );
  return current(db, command.id, lineId);
}
export async function createDiscovery(db: Database, command: Command) {
  const input = createDiscoverySchema.parse(command.input),
    action = 'stocktake.discovery.create';
  const payload = { id: command.id, ...input };
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    await tx.get('SELECT id FROM stocktakes WHERE id=? FOR UPDATE', [command.id]);
    const replay = await replayCommand(tx, action, command.key, payload, command.actor, discoverySchema);
    if (replay) return replay;
    const take = await lockCounting(tx, command.id);
    const after = await insert(tx, command, input, String(take.warehouse_code));
    await changed(tx, command, action, null, after);
    await saveCommand(tx, action, command.key, payload, command.actor, after);
    return after;
  });
}
async function update(db: Database, command: Command, input: UpdateDiscovery) {
  const before = await current(db, command.id, command.lineId!);
  ensure(before.version === input.version, 'STALE_DISCOVERY', discoveryCopy.stale);
  await validateDiscoveryProduct(db, before.warehouseCode, before.productCode);
  await db.run(
    `UPDATE stocktake_discovery_lines SET packages=?,weight_grams=?,reason=?,version=version+1,
    updated_at=UTC_TIMESTAMP(3) WHERE stocktake_id=? AND id=?`,
    [input.packages, input.weightGrams, input.reason, command.id, command.lineId!],
  );
  const after = await current(db, command.id, command.lineId!);
  await changed(db, command, 'stocktake.discovery.update', before, after);
  return after;
}
export async function updateDiscovery(db: Database, command: Command) {
  const input = updateDiscoverySchema.parse(command.input),
    action = 'stocktake.discovery.update';
  const payload = { id: command.id, lineId: command.lineId, ...input };
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    await tx.get('SELECT id FROM stocktakes WHERE id=? FOR UPDATE', [command.id]);
    const replay = await replayCommand(tx, action, command.key, payload, command.actor, discoverySchema);
    if (replay) return replay;
    await lockCounting(tx, command.id);
    const after = await update(tx, command, input);
    await saveCommand(tx, action, command.key, payload, command.actor, after);
    return after;
  });
}
export async function deleteDiscovery(db: Database, command: Command) {
  const input = deleteDiscoverySchema.parse(command.input),
    action = 'stocktake.discovery.delete';
  const payload = { id: command.id, lineId: command.lineId, ...input };
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    await tx.get('SELECT id FROM stocktakes WHERE id=? FOR UPDATE', [command.id]);
    const replay = await replayCommand(tx, action, command.key, payload, command.actor, discoveryDeletedSchema);
    if (replay) return replay;
    await lockCounting(tx, command.id);
    const before = await current(tx, command.id, command.lineId!);
    ensure(before.version === input.version, 'STALE_DISCOVERY', discoveryCopy.stale);
    await tx.run('DELETE FROM stocktake_discovery_lines WHERE stocktake_id=? AND id=?', [command.id, command.lineId!]);
    await changed(tx, command, action, before, null);
    const after = discoveryDeletedSchema.parse({ id: command.lineId, deleted: true });
    await saveCommand(tx, action, command.key, payload, command.actor, after);
    return after;
  });
}
