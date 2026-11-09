import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { correctionSummarySchema, type CorrectionInput, type CorrectionKind } from '@wms/contracts';
import { numberingFixture, origin } from './numbering-fixture.ts';
import { prepared, businessFingerprint } from './lifecycle-fixture.ts';

export async function correctionFixture(kind: CorrectionKind = 'inbound') {
  const context = await numberingFixture();
  try {
    const target = await prepared(context.db, kind),
      path = `/api/v1/${kind}/${target.id}`;
    const detail = () => context.web.get(path).expect(200);
    const input = async (delta = { packages: 1, weightGrams: 0 }): Promise<CorrectionInput> => {
      const summary = correctionSummarySchema.parse((await detail()).body.data.corrections);
      const line = summary.lines[0]!;
      return {
        expectedCorrectionRevision: summary.revision,
        previousCorrectionId: summary.latest?.id ?? null,
        reason: 'B5a 独立合成验收',
        lines: [
          {
            originalLineId: line.originalLineId,
            packages: line.effective.packages + delta.packages,
            weightGrams: line.effective.weightGrams + delta.weightGrams,
          },
        ],
      };
    };
    const post = (body: object, key = randomUUID()) =>
      context.web.post(`${path}/corrections`).set('origin', origin).set('idempotency-key', key).send(body);
    return { ...context, target, path, detail, input, post };
  } catch (error) {
    await context.dispose();
    throw error;
  }
}
export async function expectUnchanged(
  context: Awaited<ReturnType<typeof correctionFixture>>,
  body: object,
  status: number,
) {
  const before = await businessFingerprint(context.db);
  const response = await context.post(body).expect(status);
  assert.deepEqual(await businessFingerprint(context.db), before);
  return { status: response.status, code: response.body.code, databaseUnchanged: true };
}
