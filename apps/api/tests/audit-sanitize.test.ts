import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactAuditValue } from '../src/features/audit/sanitize.ts';
import { inputSummary } from '../src/features/audit/input-summary.ts';

test('audit redacts nested objects, arrays, JSON strings and multiply encoded JSON strings', () => {
  const input = {
    password: 'secret-1',
    nested: [{ bearerToken: 'secret-2', packages: 3 }],
    encoded: JSON.stringify({ inner: { Authorization: 'secret-3', value: 'safe' } }),
    twice: JSON.stringify(JSON.stringify({ cookie: 'secret-4', token: 'secret-5' })),
    jsonArray: '[{"credentials":{"apiKey":"secret-6"},"number":"RK-001"}]',
  };
  const actual = redactAuditValue(input);
  const text = JSON.stringify(actual);
  assert.doesNotMatch(text, /secret-[1-6]/);
  assert.match(text, /safe/);
  assert.match(text, /RK-001/);
  assert.deepEqual((actual as typeof input).nested, [{ bearerToken: '[已隐藏]', packages: 3 }]);
  assert.equal(input.password, 'secret-1');
});

test('audit input summary only accepts explicit scalar allowlist and collection counts', () => {
  const input = {
    productCode: '130',
    packages: 3,
    weightGrams: 5000,
    warehouseCode: 'W01',
    reason: 'password=secret',
    memo: 'secret',
    token: 'secret',
    headers: { authorization: 'secret' },
    body: { packages: 999 },
    lines: [{ productCode: '130', password: 'secret' }],
    customerCode: '{"password":"secret"}',
    supplierCode: { nested: 'secret' },
  };
  assert.deepEqual(inputSummary('inbound.create', input), {
    productCode: '130',
    packages: 3,
    weightGrams: 5000,
    warehouseCode: 'W01',
    linesCount: 1,
  });
  assert.deepEqual(inputSummary('auth.login', { ...input, username: 'owner', channel: 'pda' }), {
    claimedUsername: 'owner',
  });
});

test('audit redaction bounds cycles but preserves large business evidence and all rows', () => {
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assert.doesNotThrow(() => JSON.stringify(redactAuditValue(cycle)));
  const large = { text: '业务记录'.repeat(9000), lines: Array.from({ length: 1000 }, (_, n) => ({ packages: n })) };
  assert.deepEqual(redactAuditValue(large), large);
  assert.equal(redactAuditValue('{"password":"secret"'), '[已隐藏]');
});
