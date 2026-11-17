import type { Readable } from 'node:stream';
import { RESTORE } from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';
import { restoreText as t } from './restore-copy.ts';

function checkLine(line: string): string {
  if (Buffer.byteLength(line) > RESTORE.maximumSqlLineBytes)
    throw new AppError('RESTORE_SQL_LIMIT', t.importFailed, 409);
  return line;
}
// Read from the stream on demand: readline's eager line events can outlive its
// closed interface when the mysql process applies backpressure.
export async function* restoreLines(source: Readable): AsyncGenerator<string> {
  let pending = '';
  source.setEncoding('utf8');
  for await (const chunk of source) {
    pending += String(chunk);
    let ending: RegExpExecArray | null;
    while ((ending = /\r\n|\n|\r(?!$)/.exec(pending))) {
      yield checkLine(pending.slice(0, ending.index));
      pending = pending.slice(ending.index + ending[0].length);
    }
    checkLine(pending.endsWith('\r') ? pending.slice(0, -1) : pending);
  }
  if (pending) yield checkLine(pending.endsWith('\r') ? pending.slice(0, -1) : pending);
}
