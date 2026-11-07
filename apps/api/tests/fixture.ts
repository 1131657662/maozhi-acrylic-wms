import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { seedDemo } from '../src/db/seed-test.ts';
import { createApp } from '../src/app.ts';
import { createTestDatabase } from '../../../scripts/mysql/test-database.ts';
import type { FactInput } from '@wms/contracts';

export async function fixture() {
  const {db,dispose}=await createTestDatabase();
  try { await seedDemo(db,'test-only-password'); }
  catch(error) { await dispose(); throw error; }
  const app=createApp(db);
  return {db,dispose,app,api:request(app)};
}
export function fact(overrides:Partial<FactInput>={}):FactInput {
  return {id:randomUUID(),barcode:'DEMO-032-11',weightGrams:302500,catalogVersion:1,
    weightSource:'catalog',deviceId:'test-device',scannedAt:new Date().toISOString(),planVersion:1,...overrides};
}
export const actor={username:'owner',traceId:'test-trace'};
