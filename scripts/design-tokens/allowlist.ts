import { extname, posix } from 'node:path';
import type { AllowlistEntry, CheckResult, Finding } from './types.ts';

export function validateAllowlist(value: unknown): AllowlistEntry[] {
  if (!Array.isArray(value)) throw new Error('allowlist 必须为逐项数组');
  return value.map((entry: unknown) => {
    if (typeof entry !== 'object' || entry === null) throw new Error('allowlist 条目必须是对象');
    if (!('file' in entry && 'kind' in entry && 'value' in entry && 'reason' in entry && 'batch' in entry)) {
      throw new Error('allowlist 缺少 file/kind/value/reason/batch');
    }
    const { file, kind, value: literal, reason, batch } = entry;
    if (
      typeof file !== 'string' ||
      !file.startsWith('apps/web/src/') ||
      posix.normalize(file) !== file ||
      /[\\*?\[\]{}]/.test(file) ||
      !['.ts', '.tsx', '.js', '.jsx', '.css', '.less', '.scss'].includes(extname(file))
    ) {
      throw new Error('allowlist file 必须为精确的 Web 源文件路径');
    }
    if (kind !== 'color' && kind !== 'radius' && kind !== 'padding') throw new Error('allowlist kind 无效');
    if (
      typeof literal !== 'string' ||
      !literal.trim() ||
      typeof reason !== 'string' ||
      !reason.trim() ||
      typeof batch !== 'string' ||
      !/^B\d+[a-z]?(?:-\d+)?$/.test(batch)
    ) {
      throw new Error('allowlist 必须填写裸值、原因与具体计划批次');
    }
    return { file, kind, value: literal, reason, batch };
  });
}

export function matchAllowlist(findings: Finding[], entries: AllowlistEntry[]): CheckResult {
  const remaining = [...entries];
  const result: CheckResult = { existing: [], violations: [], stale: [] };
  for (const finding of findings) {
    const index = remaining.findIndex(
      (entry) => entry.file === finding.file && entry.kind === finding.kind && entry.value === finding.value,
    );
    const entry = remaining[index];
    if (!entry) {
      result.violations.push(finding);
      continue;
    }
    remaining.splice(index, 1);
    result.existing.push({ finding, entry });
  }
  result.stale = remaining;
  return result;
}
