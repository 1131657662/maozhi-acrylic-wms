import { createInterface } from 'node:readline';
import type { Readable } from 'node:stream';
import { RESTORE } from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';
import { restoreText as t } from './restore-copy.ts';

// The account is the security boundary. This scan also rejects USE rather than letting
// --one-database silently skip statements and report a successful partial import.
export class RestoreSqlGuard {
  private quote = '';
  private comment = false;
  private word = '';
  private escaped = false;
  scan(line: string): void {
    for (let i = 0; i < line.length; i++) {
      const char = line[i]!,
        next = line[i + 1];
      if (this.comment) {
        if (char === '*' && next === '/') {
          this.comment = false;
          i++;
        }
        continue;
      }
      if (this.quote) {
        this.consumeQuoted(char);
        continue;
      }
      if (char === '#' || (char === '-' && next === '-' && /\s/.test(line[i + 2] ?? ' '))) break;
      if (char === '/' && next === '*') {
        this.finishWord();
        if (line[i + 2] === '!') {
          i += 2;
          while (/\d/.test(line[i + 1] ?? '')) i++;
        } else {
          this.comment = true;
          i++;
        }
      } else if (char === "'" || char === '"' || char === '`') {
        this.finishWord();
        this.quote = char;
      } else if (/[a-zA-Z_]/.test(char)) this.word += char;
      else this.finishWord();
    }
    this.finishWord();
  }
  private consumeQuoted(char: string): void {
    if (this.escaped) {
      this.escaped = false;
      return;
    }
    if (char === '\\') {
      this.escaped = true;
      return;
    }
    if (char === this.quote) this.quote = '';
  }
  private finishWord(): void {
    if (this.word.toUpperCase() === 'USE') throw new AppError('RESTORE_CROSS_DATABASE', t.forbidden, 409);
    this.word = '';
  }
}
export async function* guardedRestoreSql(source: Readable): AsyncGenerator<string> {
  const lines = createInterface({ input: source, crlfDelay: Infinity });
  const guard = new RestoreSqlGuard();
  try {
    for await (const line of lines) {
      if (Buffer.byteLength(line) > RESTORE.maximumSqlLineBytes)
        throw new AppError('RESTORE_SQL_LIMIT', t.importFailed, 409);
      guard.scan(line);
      // mysqldump's trigger header only; never rewrite literals or trigger bodies.
      yield line
        .replace(/^(\/\*!50003 CREATE\*\/ )\/\*!50017 DEFINER=`(?:``|[^`])+`@`(?:``|[^`])+`\*\/ /, '$1')
        .replace(
          /^\/\*!50013 DEFINER=`(?:``|[^`])+`@`(?:``|[^`])+` SQL SECURITY DEFINER \*\/;?$/,
          '/*!50013 SQL SECURITY DEFINER */',
        ) + '\n';
    }
  } finally {
    lines.close();
    source.destroy();
  }
}
