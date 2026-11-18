import type { BackupBaseline, RestoreReport, VerificationItem } from '@wms/contracts';
import { inventoryComparisons } from './restore-inventory.ts';

function comparison(label: string, expected: string | null, actual: string | null): VerificationItem {
  const conclusion = expected === null ? 'unverified' : expected === actual ? 'passed' : 'mismatch';
  return {
    label,
    expected,
    actual,
    conclusion,
    difference:
      conclusion === 'unverified'
        ? '缺少备份时基线'
        : conclusion === 'passed'
          ? '无差异'
          : exactDifference(expected, actual),
  };
}
function exactDifference(expected: string | null, actual: string | null): string {
  if (!expected || !actual || !/^-?\d+(\.\d+)?$/.test(expected) || !/^-?\d+(\.\d+)?$/.test(actual))
    return '与备份时基线不一致';
  const places = Math.max(expected.split('.')[1]?.length ?? 0, actual.split('.')[1]?.length ?? 0);
  const scaled = (value: string) =>
    BigInt(value.replace('.', '') + '0'.repeat(places - (value.split('.')[1]?.length ?? 0)));
  const delta = scaled(actual) - scaled(expected),
    absolute = (delta < 0n ? -delta : delta).toString().padStart(places + 1, '0');
  const magnitude = places ? `${absolute.slice(0, -places)}.${absolute.slice(-places)}` : absolute;
  return `差额 ${delta < 0n ? '-' : '+'}${magnitude}`;
}
function digestComparison(label: string, expected: string | null, actual: string | null): VerificationItem {
  const result = comparison(label, expected, actual);
  return {
    ...result,
    expected: expected === null ? null : '备份时校验摘要',
    actual:
      actual === null
        ? null
        : result.conclusion === 'passed'
          ? '校验摘要一致'
          : result.conclusion === 'mismatch'
            ? '校验摘要不一致'
            : '已采集校验摘要',
  };
}
export function buildRestoreReport(
  expected: BackupBaseline | null,
  actual: Extract<BackupBaseline, { version: 2 }>,
): RestoreReport {
  const items: VerificationItem[] = [
    comparison('数据表数量', expected ? String(expected.tableCount) : null, String(actual.tableCount)),
  ];
  items.push(comparison('库存总包数', expected?.inventory.packages ?? null, actual.inventory.packages));
  items.push(comparison('库存总吨数', expected?.inventory.tonnes ?? null, actual.inventory.tonnes));
  for (const args of inventoryComparisons(expected, actual)) items.push(comparison(...args));
  if (expected?.version === 1)
    items.push({
      label: '库存行归属',
      expected: null,
      actual: null,
      conclusion: 'unverified',
      difference: '旧基线未记录库存行标志',
    });
  items.push(
    digestComparison(
      '迁移版本与校验值',
      expected ? JSON.stringify(expected.migrations) : null,
      JSON.stringify(actual.migrations),
    ),
  );
  items.push(
    comparison('迁移版本数量', expected ? String(expected.migrations.length) : null, String(actual.migrations.length)),
  );
  compareDocuments(items, expected, actual);
  compareTables(items, expected, actual);
  return {
    outcome: items.some((item) => item.conclusion === 'mismatch')
      ? 'mismatch'
      : items.some((item) => item.conclusion === 'unverified')
        ? 'limited'
        : 'passed',
    baselineAt: expected?.capturedAt ?? null,
    verifiedAt: actual.capturedAt,
    items,
  };
}
function compareTables(items: VerificationItem[], expected: BackupBaseline | null, actual: BackupBaseline): void {
  const names = [
    ...new Set([...(expected?.tables.map((table) => table.name) ?? []), ...actual.tables.map((table) => table.name)]),
  ].sort();
  for (const [index, name] of names.entries()) {
    const before = expected?.tables.find((table) => table.name === name),
      after = actual.tables.find((table) => table.name === name);
    const label = `数据表 ${index + 1}`;
    items.push(
      comparison(
        `${label}行数`,
        expected ? (before ? String(before.rows) : '不存在') : null,
        after ? String(after.rows) : '不存在',
      ),
    );
    items.push(
      digestComparison(`${label}结构`, expected ? (before?.structure ?? '不存在') : null, after?.structure ?? '不存在'),
    );
    items.push(
      digestComparison(`${label}内容`, expected ? (before?.content ?? '不存在') : null, after?.content ?? '不存在'),
    );
  }
}
function compareDocuments(items: VerificationItem[], expected: BackupBaseline | null, actual: BackupBaseline): void {
  const documents = new Map(
    [...(expected?.documents ?? []), ...actual.documents].map((doc) => [JSON.stringify([doc.kind, doc.number]), doc]),
  );
  items.push(
    comparison('抽查单据数量', expected ? String(expected.documents.length) : null, String(actual.documents.length)),
  );
  for (const doc of documents.values()) {
    const before = expected?.documents.find((row) => row.kind === doc.kind && row.number === doc.number);
    const after = actual.documents.find((row) => row.kind === doc.kind && row.number === doc.number);
    items.push(
      digestComparison(
        `${doc.kind === 'inbound' ? '入库单' : '出库单'} ${doc.number}`,
        expected ? (before?.fingerprint ?? '不存在') : null,
        after?.fingerprint ?? '不存在',
      ),
    );
  }
}
