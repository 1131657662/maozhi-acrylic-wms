import { randomUUID } from 'node:crypto';
import {
  normalizePlate,
  plateSchema,
  vehicleSchema,
  createVehicleSchema,
  updateVehicleSchema,
  masterListQuerySchema,
} from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import { audit, type Actor } from '../../shared/audit.ts';
import { AppError } from '../../shared/errors.ts';
import { lockInventoryWriter } from '../inventory/operation.ts';
import { replayCommand, saveCommand } from '../../shared/idempotency.ts';
function vehicle(row: Row) {
  return vehicleSchema.parse({
    id: row.id,
    plate: row.plate_original,
    normalizedPlate: row.plate_normalized,
    driver: row.driver,
    phone: row.phone,
    memo: row.memo,
    active: Number(row.active) === 1,
    source: row.source,
    useCount: Number(row.use_count),
    lastUsedAt: row.last_used_at,
  });
}
export async function readVehicle(db: Database, id: string) {
  const row = await db.get('SELECT * FROM master_vehicles WHERE id=?', [id]);
  if (!row) throw new AppError('NOT_FOUND', '车辆不存在', 404);
  return vehicle(row);
}
export async function listVehicles(db: Database, input: unknown) {
  const query = masterListQuerySchema.parse(input),
    pattern = `%${normalizePlate(query.keyword).replace(/[!%_]/g, '!$&')}%`;
  const filter = `plate_normalized LIKE ? ESCAPE '!'${query.status === 'all' ? '' : ` AND active=${Number(query.status === 'active')}`}`;
  return db.readSnapshot(async (tx) => ({
    items: (
      await tx.all(`SELECT * FROM master_vehicles WHERE ${filter} ORDER BY plate_normalized LIMIT ? OFFSET ?`, [
        pattern,
        query.pageSize,
        (query.page - 1) * query.pageSize,
      ])
    ).map(vehicle),
    total: Number((await tx.get(`SELECT COUNT(*) AS n FROM master_vehicles WHERE ${filter}`, [pattern]))?.n),
    page: query.page,
    pageSize: query.pageSize,
  }));
}
export async function createVehicle(db: Database, input: unknown, actor: Actor, key?: string) {
  const data = createVehicleSchema.parse(input);
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const replay = key ? await replayCommand(tx, 'vehicle.create', key, data, actor, vehicleSchema) : undefined;
    if (replay) return replay;
    const normalized = normalizePlate(data.plate);
    if (await tx.get('SELECT id FROM master_vehicles WHERE plate_normalized=?', [normalized]))
      throw new AppError('VEHICLE_EXISTS', '车牌已存在', 422);
    const id = randomUUID();
    await tx.run(
      `INSERT INTO master_vehicles(id,plate_original,plate_normalized,driver,phone,memo,source,created_at,updated_at)
      VALUES(?,?,?,?,?,?,'manual',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3))`,
      [id, data.plate, normalized, data.driver ?? null, data.phone ?? null, data.memo ?? null],
    );
    const after = await readVehicle(tx, id);
    await audit(tx, actor, { action: 'vehicle.create', targetId: id, before: null, after });
    if (key) await saveCommand(tx, 'vehicle.create', key, data, actor, after);
    return after;
  });
}
export async function updateVehicle(db: Database, id: string, input: unknown, actor: Actor) {
  const data = updateVehicleSchema.parse(input);
  return db.transaction(async (tx) => {
    await lockInventoryWriter(tx);
    const before = await readVehicle(tx, id),
      after = { ...before, ...data };
    await tx.run('UPDATE master_vehicles SET driver=?,phone=?,memo=?,active=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?', [
      after.driver ?? null,
      after.phone ?? null,
      after.memo ?? null,
      Number(after.active),
      id,
    ]);
    await audit(tx, actor, { action: 'vehicle.update', targetId: id, before, after });
    return after;
  });
}
// Caller holds the inventory writer lock and owns the document transaction.
export async function resolveDocumentVehicle(db: Database, plate: string, actor: Actor) {
  const original = plateSchema.parse(plate),
    normalized = normalizePlate(original);
  let row = await db.get('SELECT * FROM master_vehicles WHERE plate_normalized=? FOR UPDATE', [normalized]);
  if (!row) {
    const id = randomUUID();
    await db.run(
      `INSERT INTO master_vehicles(id,plate_original,plate_normalized,source,created_at,updated_at)
      VALUES(?,?,?,'auto',UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE id=id`,
      [id, original, normalized],
    );
    row = await db.get('SELECT * FROM master_vehicles WHERE plate_normalized=? FOR UPDATE', [normalized]);
    if (row?.id === id)
      await audit(db, actor, { action: 'vehicle.auto-create', targetId: id, before: null, after: vehicle(row) });
  }
  if (!row || Number(row.active) !== 1) throw new AppError('VEHICLE_INACTIVE', '该车牌已停用，请先启用', 422);
  return vehicle(row);
}
export async function recordVehicleUse(db: Database, vehicleId: string, documentId: string): Promise<void> {
  if (
    await db.get('SELECT vehicle_id FROM vehicle_document_uses WHERE vehicle_id=? AND document_id=?', [
      vehicleId,
      documentId,
    ])
  )
    return;
  await db.run('INSERT INTO vehicle_document_uses(vehicle_id,document_id,created_at) VALUES(?,?,UTC_TIMESTAMP(3))', [
    vehicleId,
    documentId,
  ]);
  await db.run('UPDATE master_vehicles SET use_count=use_count+1,last_used_at=UTC_TIMESTAMP(3) WHERE id=?', [
    vehicleId,
  ]);
}
