import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import type { RequestHandler } from 'express';
import { measurement, probe, type Measurement } from '../b6b/probe.ts';

export interface RequestSample extends Measurement {
  bytes: number;
  data: Record<string, unknown>;
}
export const requests = new Map<string, RequestSample>();
export const httpProbe: RequestHandler = (req, res, next) => {
  const id = req.header('x-b6i2-probe');
  if (!id || !/\/web\/(lists\/(inbound|outbound)|reports\/turnover)$/.test(req.path)) return next();
  const sample: RequestSample = { ...measurement(), bytes: 0, data: {} },
    start = performance.now();
  const json = res.json.bind(res);
  res.json = (body) => {
    sample.data = body.data;
    sample.bytes = Buffer.byteLength(JSON.stringify(body));
    return json(body);
  };
  res.once('finish', () => {
    sample.apiMs = performance.now() - start;
    requests.set(id, sample);
  });
  probe.run(sample, next);
};

export function businessData(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(businessData);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !['viewToken', 'rowTokens', 'queryFingerprint', 'summaryToken'].includes(key))
      .map(([key, item]) => [key, businessData(item)]),
  );
}
export function contentHash(value: unknown): string {
  return createHash('sha256')
    .update(JSON.stringify(businessData(value)))
    .digest('hex');
}

export function turnoverValueHash(value: unknown): string {
  const data = businessData(value) as { items?: Record<string, unknown>[] } & Record<string, unknown>;
  return createHash('sha256')
    .update(
      JSON.stringify({
        ...data,
        items: data.items?.map(({ formula: _formula, ...row }) => row),
      }),
    )
    .digest('hex');
}
export async function save(folder: string, name: string, data: unknown): Promise<void> {
  await mkdir(folder, { recursive: true });
  await writeFile(`${folder}/${name}.json`, JSON.stringify(data, null, 2));
}
