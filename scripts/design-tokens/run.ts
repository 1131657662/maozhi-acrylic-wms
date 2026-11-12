import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { validateAllowlist, matchAllowlist } from './allowlist.ts';
import { scanWeb } from './scan-web.ts';
import type { Finding } from './types.ts';

function location(finding: Finding): string {
  return `${finding.file}:${finding.line}:${finding.column} ${finding.kind} ${JSON.stringify(finding.value)}`;
}

export async function runCheck(repository: string, write: (line: string) => void = console.log): Promise<number> {
  try {
    const raw: unknown = JSON.parse(await readFile(join(repository, 'scripts/design-tokens/allowlist.json'), 'utf8'));
    const entries = validateAllowlist(raw);
    const { findings, files } = await scanWeb(repository);
    const result = matchAllowlist(findings, entries);
    for (const { finding, entry } of result.existing)
      write(`现有（${entry.batch}）：${location(finding)} — ${entry.reason}`);
    for (const finding of result.violations) write(`新增违规：${location(finding)}`);
    for (const entry of result.stale)
      write(`待清理 allowlist：${entry.file} ${entry.kind} ${JSON.stringify(entry.value)}`);
    write(
      `Web 文件 ${files}；现有 ${result.existing.length}；新增 ${result.violations.length}；待清理 ${result.stale.length}`,
    );
    return result.violations.length ? 1 : 0;
  } catch (error: unknown) {
    write(`设计 token 检查失败：${error instanceof Error ? error.message : String(error)}`);
    return 1;
  }
}
