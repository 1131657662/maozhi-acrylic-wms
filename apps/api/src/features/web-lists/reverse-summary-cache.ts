import type { WebMatchedTotals } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { hash } from '../../shared/hash.ts';
import type { Predicate } from './query.ts';

const SUMMARY_TTL_MS = 5 * 60 * 1000,
  SUMMARY_MAX_ENTRIES = 256;
interface Entry {
  version: number;
  expires: number;
  totals: WebMatchedTotals;
}
const caches = new WeakMap<Database['readCacheClock'], Map<string, Entry>>();

export function clearReverseSummaryCache(db: Database): void {
  caches.get(db.readCacheClock)?.clear();
}

export async function reverseSummaryCache(db: Database, predicate: Predicate) {
  const version = db.readCacheClock.version;
  // Establish the InnoDB read view before looking up cached totals. MAX(id) alone is not an invalidation clock:
  // concurrent transactions can commit out of allocation order; the process clock also observes their completion.
  const row = await db.get(
    'SELECT DATABASE() AS name,(SELECT id FROM operation_log ORDER BY id DESC LIMIT 1) AS auditId',
  );
  const key = hash(JSON.stringify([row, predicate])),
    now = Date.now();
  const entries = caches.get(db.readCacheClock) ?? new Map<string, Entry>();
  caches.set(db.readCacheClock, entries);
  for (const [key, value] of entries) if (value.expires <= now || value.version !== version) entries.delete(key);
  return {
    get(): WebMatchedTotals | undefined {
      const entry = entries.get(`${version}:${key}`);
      return entry && db.readCacheClock.version === version ? { ...entry.totals } : undefined;
    },
    put(totals: WebMatchedTotals): void {
      if (version !== db.readCacheClock.version) return undefined;
      entries.set(`${version}:${key}`, { version, expires: now + SUMMARY_TTL_MS, totals: { ...totals } });
      while (entries.size > SUMMARY_MAX_ENTRIES) entries.delete(entries.keys().next().value!);
    },
  };
}
