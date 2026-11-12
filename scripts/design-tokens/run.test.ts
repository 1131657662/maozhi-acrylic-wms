import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { runCheck } from './run.ts';

async function fixture(files: Record<string, string>): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'wms-design-tokens-'));
  for (const [file, contents] of Object.entries({ 'scripts/design-tokens/allowlist.json': '[]', ...files })) {
    await mkdir(dirname(join(root, file)), { recursive: true });
    await writeFile(join(root, file), contents);
  }
  return root;
}

async function removeFixture(root: string): Promise<void> {
  const target = resolve(root);
  if (dirname(target) !== resolve(tmpdir()) || !basename(target).startsWith('wms-design-tokens-')) {
    throw new Error('拒绝清理非本测试临时目录');
  }
  await rm(target, { recursive: true, force: true });
}

test('scan is limited to Web src and includes new files while excluding generated Umi files', async (t) => {
  const root = await fixture({
    'apps/web/src/page.css': '.page { padding: var(--wms-space-8); }',
    'apps/web/src/.umi/runtime.ts': 'const style = { padding: 8 };',
    'apps/web/config/config.ts': 'const color = "#123";',
    'apps/miniapp/app.wxss': '.page { padding: 8px; }',
    'apps/pda/colors.xml': '<color>#123</color>',
  });
  t.after(() => removeFixture(root));
  const output: string[] = [];
  assert.equal(await runCheck(root, (line) => output.push(line)), 0);
  assert.match(output.at(-1) ?? '', /Web 文件 1；现有 0；新增 0/);
  await writeFile(join(root, 'apps/web/src/new.tsx'), 'const x = <div style={{ padding: 8 }} />;');
  assert.equal(await runCheck(root, (line) => output.push(line)), 1);
  assert.ok(output.some((line) => line.includes('new.tsx')));
});

test('CLI reports existing entries successfully then exits nonzero for a duplicate', async (t) => {
  const entry = { file: 'apps/web/src/page.css', kind: 'padding', value: '8px', reason: '保留', batch: 'B6j-2' };
  const root = await fixture({
    'apps/web/src/page.css': '.page { padding: 8px; }',
    'scripts/design-tokens/allowlist.json': JSON.stringify([entry]),
  });
  t.after(() => removeFixture(root));
  const moduleUrl = new URL('./run.ts', import.meta.url).href;
  const script = `import { runCheck } from ${JSON.stringify(moduleUrl)}; process.exitCode = await runCheck(${JSON.stringify(root)});`;
  const options = { cwd: fileURLToPath(new URL('../../', import.meta.url)), encoding: 'utf8' as const };
  const accepted = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], options);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.match(accepted.stdout, /现有 1；新增 0/);
  await writeFile(join(root, 'apps/web/src/page.css'), '.page { padding: 8px; } .copy { padding: 8px; }');
  const rejected = spawnSync(process.execPath, ['--import', 'tsx', '--input-type=module', '-e', script], options);
  assert.equal(rejected.status, 1, rejected.stderr);
  assert.match(rejected.stdout, /现有 1；新增 1/);
});

test('invalid allowlist and parse errors return failure', async (t) => {
  const root = await fixture({ 'apps/web/src/page.css': '.page { padding: 8px;' });
  t.after(() => removeFixture(root));
  const output: string[] = [];
  assert.equal(await runCheck(root, (line) => output.push(line)), 1);
  assert.match(output.at(-1) ?? '', /检查失败/);
  await writeFile(join(root, 'scripts/design-tokens/allowlist.json'), '{');
  assert.equal(await runCheck(root, () => {}), 1);
});
