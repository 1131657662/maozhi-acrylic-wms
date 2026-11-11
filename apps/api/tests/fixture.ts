import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { seedDemo } from '../src/db/seed-test.ts';
import { createApp } from '../src/app.ts';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import type { FactInput } from '@wms/contracts';

export async function fixture(through?: string) {
  const { db, dispose } = await createTestDatabase(through);
  try {
    await seedDemo(db, 'test-only-password');
  } catch (error) {
    await dispose();
    throw error;
  }
  const app = createApp(db);
  return { db, dispose, app, api: request(app) };
}
export function fact(overrides: Partial<FactInput> = {}): FactInput {
  return {
    id: randomUUID(),
    barcode: 'DEMO-032-11',
    weightGrams: 302500,
    catalogVersion: 1,
    weightSource: 'catalog',
    deviceId: 'test-device',
    scannedAt: new Date().toISOString(),
    planVersion: 1,
    ...overrides,
  };
}
export const actor = { username: 'owner', traceId: 'test-trace' };

// Legacy scenarios explicitly accept scanner quantities as the manual form values.
export async function confirmScannedFixture(
  db: import('../src/db/mysql.ts').Database,
  command: import('../src/shared/command.ts').PlanCommand,
) {
  const { getOrder } = await import('../src/features/outbound/repository.ts');
  const { confirmOutbound } = await import('../src/features/outbound/confirm.ts');
  const order = await getOrder(db, command.planId);
  return confirmOutbound(db, {
    ...command,
    lines: order.lines.map((line) => ({
      lineId: line.id,
      actualPackages: line.scanPackages ?? 0,
      actualWeightGrams: line.scanWeightGrams ?? 0,
    })),
  });
}
