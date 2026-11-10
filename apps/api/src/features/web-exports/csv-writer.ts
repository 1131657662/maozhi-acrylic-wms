import { createWriteStream } from 'node:fs';
import { setImmediate as yieldLoop } from 'node:timers/promises';
import { listCellText, type ExportKind, type ListField } from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';
import type { ExportWriter } from './writer.ts';

const maxExcelInteger = 999_999_999_999_999;

function csvCell(value: string, protectFormula = true): string {
  const safe = protectFormula && /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

export class CsvWriter implements ExportWriter {
  private readonly output;
  private failure: Error | undefined;
  private sums = new Map<string, bigint>();
  private incompleteSums = new Set<string>();
  constructor(readonly config: { filename: string; kind: ExportKind; fields: ListField[]; rowUnit?: '条' | '行' }) {
    this.output = createWriteStream(config.filename, { flags: 'wx' });
    this.output.on('error', (error) => {
      this.failure = error;
    });
    this.output.write('\ufeff' + config.fields.map((field) => csvCell(field.label)).join(',') + '\r\n');
  }
  append(row: Record<string, unknown>): string[] {
    const display = this.config.fields.map((field) => listCellText(this.config.kind, field, row));
    for (const field of this.config.fields) this.addTotal(field, row);
    this.output.write(
      display.map((value, index) => csvCell(value, this.config.fields[index]!.type === 'text')).join(',') + '\r\n',
    );
    return display;
  }
  private addTotal(field: ListField, row: Record<string, unknown>): void {
    if (row[field.key] == null || row[field.key] === '') {
      if (field.type !== 'text' && field.total !== false) this.incompleteSums.add(field.key);
      return;
    }
    if (field.type === 'text' || field.type === 'date' || field.total === false) return;
    const raw = Number(row[field.key]);
    if (!Number.isSafeInteger(raw) || Math.abs(raw) > maxExcelInteger)
      throw new AppError('EXPORT_PRECISION', '数值超出导出精度，未生成失真文件', 422);
    this.sums.set(field.key, (this.sums.get(field.key) ?? 0n) + BigInt(raw));
  }
  totals(): Record<string, string> {
    return Object.fromEntries(
      this.config.fields
        .filter((field) => this.sums.has(field.key) && !this.incompleteSums.has(field.key))
        .map((field) => {
          const sum = this.sums.get(field.key)!;
          return [field.key, field.type === 'tonnes' ? (Number(sum) / 1_000_000).toFixed(4) : sum.toString()];
        }),
    );
  }
  async drain(): Promise<void> {
    await yieldLoop();
    if (this.failure) throw this.failure;
    if (this.output.writableNeedDrain)
      await new Promise<void>((resolve, reject) => {
        const cleanup = () => {
          this.output.off('drain', done);
          this.output.off('error', fail);
        };
        const done = () => {
          cleanup();
          resolve();
        };
        const fail = (error: Error) => {
          cleanup();
          reject(error);
        };
        this.output.once('drain', done);
        this.output.once('error', fail);
      });
  }
  async finish(count: number): Promise<void> {
    const totals = this.totals();
    const cells = this.config.fields.map((field, index) =>
      index === 0 ? `合计（${count} ${this.config.rowUnit ?? '条'}）` : (totals[field.key] ?? ''),
    );
    this.output.write(
      cells.map((value, index) => csvCell(value, this.config.fields[index]!.type === 'text')).join(',') + '\r\n',
    );
    await new Promise<void>((resolve, reject) => {
      this.output.once('finish', resolve);
      this.output.once('error', reject);
      this.output.end();
    });
    if (this.failure) throw this.failure;
  }
  async abort(): Promise<void> {
    this.output.destroy();
    if (!this.output.closed) await new Promise<void>((resolve) => this.output.once('close', resolve));
  }
}
