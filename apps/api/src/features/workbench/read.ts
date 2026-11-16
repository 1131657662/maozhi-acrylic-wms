import { workbenchSchema, workbenchCopy as copy, workbenchLinks, type WorkbenchBlock } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { isoDate } from '../../db/dates.ts';
import { hash } from '../../shared/hash.ts';
import { logger } from '../../shared/logger.ts';
import { dashboardPeriod, select } from './metrics.ts';
import { dashboardMovements } from './movements.ts';
import { dashboardPending } from './pending.ts';
import { dashboardCatalog } from './catalog.ts';
import { dashboardHandoff } from './handoff.ts';
import { dashboardVehicles } from './vehicles.ts';
import { dashboardRecent } from './recent.ts';

async function block<T>(read: () => Promise<T | null>): Promise<WorkbenchBlock<T>> {
  try {
    const data = await read();
    return {
      data,
      verification: data === null ? 'unverifiable' : 'verified',
      reason: data === null ? copy.emptyCatalog : null,
    };
  } catch (error) {
    // Keep internal details out of the response. Broken connections must abort the whole read snapshot.
    if (error && typeof error === 'object' && 'fatal' in error && error.fatal) throw error;
    logger.warn({ err: error }, 'Workbench block read failed');
    return { data: null, verification: 'failed', reason: copy.failed };
  }
}
export async function readDashboard(tx: Database) {
  const head = await tx.get(`${select} UTC_TIMESTAMP(3) AS time,(SELECT MAX(id) FROM stock_journal) AS journal,
    (SELECT COUNT(*) FROM document_date_corrections) AS corrections`);
  const asOf = isoDate(head!.time),
    period = dashboardPeriod(asOf);
  const movements = await block(() => dashboardMovements(tx, period));
  if (movements.data?.inbound.grams.verification === 'unverifiable') {
    movements.verification = 'unverifiable';
    movements.reason = movements.data.inbound.grams.reason;
  }
  const pending = await block(() => dashboardPending(tx, period));
  const catalogHealth = await block(() => dashboardCatalog(tx, period));
  const handoffEvidence = await block(() => dashboardHandoff(tx, period));
  const vehicleOrders = await block(() => dashboardVehicles(tx, period));
  const recent = await block(() => dashboardRecent(tx));
  const { points, ...today } = movements.data ?? { points: null };
  const sections = {
    today: { ...movements, data: movements.data ? today : null },
    pending,
    catalogHealth,
    handoffEvidence,
    vehicleOrders,
    recent,
    shortcuts: { data: workbenchLinks, verification: 'verified', reason: null },
    trend14d: { ...movements, data: points },
  };
  const verification = [movements, pending, catalogHealth, handoffEvidence, vehicleOrders, recent].some(
    (b) => b.verification === 'failed',
  )
    ? 'failed'
    : movements.data?.inbound.grams.verification === 'unverifiable' || catalogHealth.verification === 'unverifiable'
      ? 'unverifiable'
      : 'verified';
  return workbenchSchema.parse({
    asOf,
    watermark: hash(JSON.stringify([head, sections])),
    basis: 'posted',
    verification,
    ...sections,
  });
}
