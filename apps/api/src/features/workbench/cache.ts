import { WORKBENCH, type Workbench } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { readDashboard } from './read.ts';

interface Entry {
  version: number;
  expires: number;
  data: Workbench;
}
interface Loading {
  version: number;
  promise: Promise<Workbench>;
}
const cache = new WeakMap<Database['readCacheClock'], Entry>();
const loading = new WeakMap<Database['readCacheClock'], Loading>();
export function clearDashboardCache(db: Database): void {
  cache.delete(db.readCacheClock);
}

export async function dashboard(db: Database): Promise<Workbench> {
  const clock = db.readCacheClock,
    version = clock.version,
    now = Date.now();
  const entry = cache.get(clock),
    pending = loading.get(clock);
  if (entry?.version === version && entry.expires > now) return structuredClone(entry.data);
  if (pending?.version === version) return structuredClone(await pending.promise);
  const promise = db.readSnapshot(readDashboard);
  const request = { version, promise };
  loading.set(clock, request);
  try {
    const data = await promise;
    if (version === clock.version && data.verification !== 'failed')
      cache.set(clock, { version, expires: Date.now() + WORKBENCH.ttlMs, data: structuredClone(data) });
    return data;
  } finally {
    if (loading.get(clock) === request) loading.delete(clock);
  }
}
