import { createHash, type Hash } from 'node:crypto';
import type { ReportQuery } from '@wms/contracts';
import type { Database, Row } from '../../db/mysql.ts';
import type { Cell, Period, Projection } from './types.ts';
import { balanceFields, balanceFrom, dimensionFilter } from './sql.ts';
import { normalizeEvent } from './normalize.ts';
import { cellFor, reportPeriods } from './periods.ts';
import { consumeEvent, finishRow } from './accumulate.ts';
import { validateAnchors } from './anchors.ts';
import { totalBalance } from './totals.ts';
import { sourceDiagnostics, hashReferences } from './diagnostics.ts';
import { documentCounts } from './counts.ts';

interface ProjectionState {
  cells: Map<string, Cell>;
  periods: Period[];
  digest: Hash;
  cursor: number;
  missingTime: number;
  historical: boolean;
  detailTotal: number;
  chronological: boolean;
  lastTime: string;
  movement: ReportQuery['movement'];
  captureEvents: boolean;
}
function consumeRow(state: ProjectionState, row: Row): void {
  state.digest.update(JSON.stringify(row));
  const event = normalizeEvent(row);
  state.cursor = event.sequence;
  if (event.deleted) return;
  state.historical ||= event.historical;
  if (!event.localTime) state.missingTime++;
  if (event.localTime) {
    state.chronological &&= event.localTime >= state.lastTime;
    state.lastTime = event.localTime;
  }
  const range = state.periods[0]!;
  if (
    event.localTime &&
    event.localTime >= range.start &&
    event.localTime < range.end &&
    ['inbound', 'outbound'].includes(event.family) &&
    (state.movement === 'all' || state.movement === event.family)
  )
    state.detailTotal++;
  const key = JSON.stringify([event.warehouseCode, event.productCode]);
  const cell = state.cells.get(key) ?? cellFor(event, state.periods);
  state.cells.set(key, cell);
  if (state.captureEvents) cell.events!.push(event);
  consumeEvent(cell, event, state.periods);
}
async function readEvents(db: Database, state: ProjectionState, query: ReportQuery): Promise<void> {
  const filter = dimensionFilter(query);
  for (;;) {
    // A primary-key batch stays bounded; hash joins otherwise sort the remaining ledger on every batch.
    const rows = await db.all(
      `SELECT /*+ NO_BNL(p,w,o) */ STRAIGHT_JOIN ${balanceFields} ${balanceFrom}
      WHERE s.id>? ${filter.sql} ORDER BY s.id LIMIT 2000`,
      [state.cursor, ...filter.values],
    );
    if (!rows.length) return;
    for (const row of rows) consumeRow(state, row);
  }
}
export async function buildProjection(db: Database, query: ReportQuery, captureEvents = false): Promise<Projection> {
  const state: ProjectionState = {
    cells: new Map(),
    periods: reportPeriods(query),
    digest: createHash('sha256'),
    cursor: 0,
    missingTime: 0,
    historical: false,
    detailTotal: 0,
    chronological: true,
    lastTime: '',
    movement: query.movement,
    captureEvents,
  };
  await readEvents(db, state, query);
  await documentCounts(db, state.cells, query);
  await validateAnchors(db, { ...state, query });
  await hashReferences(db, state.digest);
  const diagnostics = await sourceDiagnostics(db, query);
  state.digest.update(JSON.stringify(diagnostics));
  for (const cell of state.cells.values()) for (const row of cell.periods.values()) finishRow(row);
  return finishProjection(state, query, diagnostics);
}
function finishProjection(
  state: ProjectionState,
  query: ReportQuery,
  diagnostics: Awaited<ReturnType<typeof sourceDiagnostics>>,
): Projection {
  const entries = [...state.cells.values()],
    reconciliation = totalBalance(entries);
  if (diagnostics.unassignedRows) {
    reconciliation.checkState = '不可验证';
    reconciliation.reasons.push('存在无法判定库存来源的流水，未混入 ERP 发生额；需核实主数据');
  }
  return {
    cells: state.cells,
    periods: state.periods,
    detailTotal: state.detailTotal,
    chronological: state.chronological,
    digest: state.digest.digest('hex'),
    monthly: entries.flatMap((c) => [...c.periods.values()].filter((r) => r.period !== 'range')),
    metadata: {
      source: 'erp-product',
      fromDay: query.fromDay,
      toDay: query.toDay,
      watermark: state.cursor,
      timeStatus: state.historical ? '时间未核实' : 'UTC → 上海时间',
      ...diagnostics,
      missingTime: state.missingTime,
      unverifiedCells: entries.filter((c) => c.periods.get('range')!.checkState === '不可验证').length,
      totalCells: entries.length,
      reconciliation,
    },
  };
}
