import { AsyncLocalStorage } from 'node:async_hooks';
import { performance } from 'node:perf_hooks';
import type { RequestHandler } from 'express';
import { Database } from '../../apps/api/src/db/mysql.ts';

export interface SqlSample {
  sql: string;
  values: Parameters<Database['all']>[1];
  ms: number;
  rows: number;
}
export interface Measurement {
  apiMs: number;
  sqlMs: number;
  queries: SqlSample[];
  total?: number;
  returned?: number;
}
export const probe = new AsyncLocalStorage<Measurement>();
export const requests = new Map<string, Measurement>();
export const measurement = (): Measurement => ({ apiMs: 0, sqlMs: 0, queries: [] });

// Instrument only this disposable verification process, never the application build.
export function installProbe(): () => void {
  const original = Database.prototype.all;
  Database.prototype.all = async function (sql, values) {
    const started = performance.now();
    const rows = await original.call(this, sql, values);
    const sample = probe.getStore();
    if (sample) {
      const ms = performance.now() - started;
      sample.sqlMs += ms;
      sample.queries.push({ sql, values, ms, rows: rows.length });
    }
    return rows;
  };
  return () => {
    Database.prototype.all = original;
  };
}

export const probeHttp: RequestHandler = (req, res, next) => {
  const id = req.header('x-b6b-probe');
  if (!id || !/^\/api\/v1\/web\/lists\/(inbound|outbound)$/.test(req.path)) return next();
  const sample = measurement();
  const started = performance.now();
  const json = res.json.bind(res);
  res.json = (body) => {
    sample.total = body.data?.total;
    sample.returned = body.data?.items?.length;
    return json(body);
  };
  res.once('finish', () => {
    sample.apiMs = performance.now() - started;
    requests.set(id, sample);
  });
  probe.run(sample, next);
};

export function p95(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return Number(sorted[Math.ceil(sorted.length * 0.95) - 1]!.toFixed(2));
}
