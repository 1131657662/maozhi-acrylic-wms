import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';
import { scanCss } from './scan-css.ts';
import { scanScript } from './scan-script.ts';
import type { Finding } from './types.ts';

const sourceExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.css', '.less', '.scss']);
const generatedDirectories = new Set(['.umi', '.umi-production', '.umi-test', 'node_modules']);

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    if (entry.isSymbolicLink()) throw new Error(`扫描范围内不支持符号链接：${join(directory, entry.name)}`);
    if (entry.isDirectory() && !generatedDirectories.has(entry.name))
      files.push(...(await sourceFiles(join(directory, entry.name))));
    if (entry.isFile() && sourceExtensions.has(extname(entry.name)) && !entry.name.endsWith('.d.ts')) {
      files.push(join(directory, entry.name));
    }
  }
  return files;
}

export async function scanWeb(repository: string): Promise<{ findings: Finding[]; files: number }> {
  const files = await sourceFiles(join(repository, 'apps/web/src'));
  const findings: Finding[] = [];
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    const name = relative(repository, file).replaceAll('\\', '/');
    const scan = ['.css', '.less', '.scss'].includes(extname(file)) ? scanCss : scanScript;
    findings.push(...scan(name, source));
  }
  return { findings, files: files.length };
}
