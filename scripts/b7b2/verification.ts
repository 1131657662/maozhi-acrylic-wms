import assert from 'node:assert/strict';
import type { Analysis } from '@wms/contracts';

const sections = ['monthly', 'comparison', 'tops', 'aging', 'turnover', 'heatmap', 'duration'] as const;
export function verifySample(data: Analysis) {
  const states = Object.fromEntries(
    sections.map((key) => [key, { verification: data[key].verification, reason: data[key].reason }]),
  );
  for (const key of ['monthly', 'comparison', 'heatmap'] as const) assert.equal(data[key].verification, 'verified');
  for (const key of sections) {
    assert.notEqual(data[key].verification, 'failed');
    if (data[key].verification === 'unverifiable') assert.ok(data[key].reason);
  }
  // The shared isolated fixture inserts 100,000 receipts of 300,100 grams each, with no outbound movement.
  assert.equal(data.comparison.data!.current.inboundGrams, 100_000 * 300_100);
  assert.equal(data.comparison.data!.current.outboundGrams, 0);
  assert.equal(data.heatmap.data!.days.length, 183);
  return states;
}
