import { ANALYSIS, type Analysis, type AnalysisQuery } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { readAnalysis } from './read.ts';

interface Entry {
  version: number;
  expiresAt: number;
  data: Analysis;
}
interface Pending {
  version: number;
  promise: Promise<Analysis>;
}
const cache = new WeakMap<Database['readCacheClock'], Map<string, Entry>>();
const pending = new WeakMap<Database['readCacheClock'], Map<string, Pending>>();
const CACHE_LIMIT = 64;

function key(query: AnalysisQuery): string {
  return JSON.stringify([query.fromDay, query.toDay, query.basis]);
}

export async function analysis(db: Database, query: AnalysisQuery): Promise<Analysis> {
  const clock = db.readCacheClock,
    version = clock.version,
    cacheKey = key(query),
    entries = cache.get(clock) ?? new Map<string, Entry>(),
    loading = pending.get(clock) ?? new Map<string, Pending>(),
    current = entries.get(cacheKey),
    active = loading.get(cacheKey);
  cache.set(clock, entries);
  pending.set(clock, loading);
  if (current?.version === version && current.expiresAt > Date.now()) return structuredClone(current.data);
  if (active?.version === version) return structuredClone(await active.promise);
  const promise = db.readSnapshot((tx) => readAnalysis(tx, query)),
    request = { version, promise };
  loading.set(cacheKey, request);
  try {
    const data = await promise;
    if (version === clock.version) {
      for (const [entryKey, entry] of entries)
        if (entry.expiresAt <= Date.now() || entry.version !== version) entries.delete(entryKey);
      entries.set(cacheKey, { version, expiresAt: Date.now() + ANALYSIS.ttlMs, data: structuredClone(data) });
      while (entries.size > CACHE_LIMIT) entries.delete(entries.keys().next().value!);
    }
    return data;
  } finally {
    if (loading.get(cacheKey) === request) loading.delete(cacheKey);
  }
}
