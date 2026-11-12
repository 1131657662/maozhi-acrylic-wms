import assert from 'node:assert/strict';
import test from 'node:test';
import { matchAllowlist, validateAllowlist } from './allowlist.ts';
import type { AllowlistEntry, Finding } from './types.ts';

function entry(overrides: Partial<AllowlistEntry> = {}): AllowlistEntry {
  return {
    file: 'apps/web/src/page.css',
    kind: 'padding',
    value: '8px',
    reason: '保留页面视觉',
    batch: 'B6j-2',
    ...overrides,
  };
}

function finding(overrides: Partial<Finding> = {}): Finding {
  return { file: 'apps/web/src/page.css', kind: 'padding', value: '8px', line: 2, column: 3, ...overrides };
}

test('one allowlist entry admits exactly one occurrence', () => {
  const result = matchAllowlist([finding(), finding({ line: 3 })], [entry()]);
  assert.equal(result.existing.length, 1);
  assert.equal(result.violations.length, 1);
  assert.equal(result.violations[0]?.line, 3);
});

test('changing file, kind or literal is a new violation', () => {
  for (const overrides of [{ file: 'apps/web/src/other.css' }, { kind: 'radius' as const }, { value: '12px' }]) {
    const result = matchAllowlist([finding(overrides)], [entry()]);
    assert.equal(result.violations.length, 1);
    assert.equal(result.stale.length, 1);
  }
});

test('a migrated occurrence reports a stale entry without adding a violation', () => {
  const result = matchAllowlist([], [entry()]);
  assert.equal(result.stale.length, 1);
  assert.equal(result.violations.length, 0);
});

for (const file of [
  'apps/web/src/',
  'apps/web/src/**',
  'apps/web/src/*.css',
  'apps/web/src/../other.css',
  'apps/miniapp/app.wxss',
]) {
  test(`reject broad or out-of-scope allowlist path ${file}`, () => {
    assert.throws(() => validateAllowlist([entry({ file })]), /精确/);
  });
}

test('allowlist requires reason and concrete migration batch', () => {
  assert.throws(() => validateAllowlist([entry({ reason: '' })]), /原因/);
  assert.throws(() => validateAllowlist([entry({ batch: 'later' })]), /批次/);
  assert.throws(() => validateAllowlist([{ file: 'apps/web/src/page.css' }]), /缺少/);
  assert.deepEqual(validateAllowlist([entry()]), [entry()]);
});
