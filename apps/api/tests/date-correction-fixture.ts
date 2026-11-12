import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { dateCorrectionHistorySchema, shanghaiToday, type CorrectionKind } from '@wms/contracts';
import { numberingFixture, newPlan, newReceipt, origin } from './numbering-fixture.ts';
import { businessFingerprint } from './lifecycle-fixture.ts';

export async function dateFixture(kind: CorrectionKind = 'inbound') {
  const c = await numberingFixture();
  try {
    const post = (path: string, input: object) =>
      c.web.post(`/api/v1${path}`).set('origin', origin).set('idempotency-key', randomUUID()).send(input);
    const document = (await post(`/${kind}`, kind === 'inbound' ? newReceipt() : newPlan()).expect(200)).body.data;
    await post(
      `/${kind}/${document.id}/${kind === 'inbound' ? 'confirm' : 'shipments'}`,
      kind === 'inbound'
        ? {}
        : {
            revision: document.revision,
            digest: document.digest,
            lines: [{ lineId: document.lines[0].id, actualPackages: 1, actualWeightGrams: 302500 }],
          },
    ).expect(200);
    const documentPath = `/api/v1/${kind}/${document.id}`,
      path = `${documentPath}/date-corrections`;
    return {
      ...c,
      kind,
      target: { kind, id: String(document.id) },
      path: documentPath,
      detail: () => c.web.get(documentPath).expect(200),
      table: kind === 'inbound' ? 'inbound_receipts' : 'outbound_orders',
      history: async () => dateCorrectionHistorySchema.parse((await c.web.get(path).expect(200)).body.data),
      send: (input: object, key = randomUUID()) =>
        c.web.post(path).set('origin', origin).set('idempotency-key', key).send(input),
    };
  } catch (error) {
    await c.dispose();
    throw error;
  }
}
export const dateInput = (afterDate = shanghaiToday(), expectedRevision = 0) => ({
  afterDate,
  expectedRevision,
  reason: '核对送货日期',
});
export const shiftedDate = (date: string, days: number) =>
  new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
export async function rejectDate(c: Awaited<ReturnType<typeof dateFixture>>, input: object, status: number) {
  const before = await businessFingerprint(c.db);
  const result = await c.send(input).expect(status);
  assert.deepEqual(await businessFingerprint(c.db), before);
  return result;
}
