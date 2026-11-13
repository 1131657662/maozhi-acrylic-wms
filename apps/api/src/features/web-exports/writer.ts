import ExcelJS from 'exceljs';
import { createWriteStream } from 'node:fs';
import { finished } from 'node:stream/promises';
import { setImmediate as yieldLoop } from 'node:timers/promises';
import { listCellText, type ReportMeta, type DerivedReportMeta, type ReportView } from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';
import { writeReconciliation } from './report-sheet.ts';
import { writeReportView } from './report-view-sheet.ts';
import type { XlsxConfig, XlsxField } from './xlsx-config.ts';

const formats = { text: '@', integer: '0', tonnes: '0.0000', kilograms: '0.000', date: 'yyyy-mm-dd hh:mm:ss' };
const maxExcelInteger = 999_999_999_999_999;
export interface ExportWriter {
  append(row: Record<string, unknown>): string[];
  totals(): Record<string, string>;
  drain(): Promise<void>;
  finish(count: number, report?: ReportMeta | DerivedReportMeta, view?: ReportView): Promise<void>;
  abort(): Promise<void>;
}
export class XlsxWriter implements ExportWriter {
  private readonly output;
  private readonly book;
  private readonly sheet;
  private readonly completion: Promise<void>;
  private failure: Error | undefined;
  private sums = new Map<string, bigint>();
  private incompleteSums = new Set<string>();
  constructor(readonly config: XlsxConfig) {
    this.output = config.stream ?? createWriteStream(config.filename!, { flags: 'wx' });
    this.output.on('error', (e: Error) => {
      this.failure = e;
    });
    this.completion = finished(this.output, { cleanup: true });
    void this.completion.catch((error: Error) => {
      this.failure = error;
    });
    this.book = new ExcelJS.stream.xlsx.WorkbookWriter({
      stream: this.output,
      useStyles: true,
      useSharedStrings: false,
    });
    this.book.creator = '茂智腈纶仓';
    this.sheet = this.book.addWorksheet('导出记录', {
      views: [{ state: 'frozen', ySplit: 1 }],
      properties: { defaultRowHeight: 24 },
    });
    this.sheet.columns = config.fields.map((f) => ({
      header: f.label,
      key: f.key,
      width: f.width,
      style: {
        numFmt: formats[f.type],
        font: { name: 'Microsoft YaHei', size: 11 },
        alignment: { vertical: 'middle', wrapText: true },
      },
    }));
    this.sheet.getRow(1).font = { name: 'Microsoft YaHei', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    this.sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    this.sheet.getRow(1).height = 30;
    this.sheet.getRow(1).commit();
  }
  append(row: Record<string, unknown>): string[] {
    const display = this.config.fields.map((f) =>
      f.type === 'kilograms'
        ? (Number(row[f.key]) / 1000).toFixed(3)
        : this.config.kind
          ? listCellText(this.config.kind, { ...f, type: f.type }, row)
          : String(row[f.key] ?? '-'),
    );
    if (display.some((v) => v.length > 32767))
      throw new AppError('EXPORT_CELL_TOO_LONG', '文本超出 Excel 单元格容量，未生成截断文件', 422);
    const values = this.config.fields.map((f, i) => this.value(f, row, display[i]!));
    const next = this.sheet.addRow(values);
    next.height = Math.min(
      300,
      24 * Math.max(1, ...display.map((v, i) => Math.ceil((v.length * 2) / this.config.fields[i]!.width))),
    );
    next.commit();
    return display;
  }
  private value(field: XlsxField, row: Record<string, unknown>, text: string): string | number | Date {
    if (row[field.key] == null || row[field.key] === '') {
      if (field.type !== 'text' && field.total !== false) this.incompleteSums.add(field.key);
      return text;
    }
    if (field.type === 'date') return new Date(Date.parse(String(row[field.key])) + 8 * 3600_000);
    if (field.type === 'text') return text;
    const raw = Number(row[field.key]);
    if (!Number.isSafeInteger(raw) || Math.abs(raw) > maxExcelInteger)
      throw new AppError('EXPORT_PRECISION', '数值超出 Excel 15 位精度，未生成失真文件', 422);
    if (field.total !== false) this.sums.set(field.key, (this.sums.get(field.key) ?? 0n) + BigInt(raw));
    return field.type === 'tonnes' ? raw / 1_000_000 : field.type === 'kilograms' ? raw / 1000 : raw;
  }
  totals(): Record<string, string> {
    return Object.fromEntries(
      this.config.fields
        .filter((f) => this.sums.has(f.key) && !this.incompleteSums.has(f.key))
        .map((f) => {
          const sum = this.sums.get(f.key)!;
          if (sum > BigInt(maxExcelInteger) || sum < -BigInt(maxExcelInteger))
            throw new AppError('EXPORT_PRECISION', '合计超出精确导出范围', 422);
          return [
            f.key,
            f.type === 'tonnes'
              ? (Number(sum) / 1_000_000).toFixed(4)
              : f.type === 'kilograms'
                ? (Number(sum) / 1000).toFixed(3)
                : sum.toString(),
          ];
        }),
    );
  }
  async drain(): Promise<void> {
    await yieldLoop();
    if (this.failure) throw this.failure;
    if (this.output.destroyed) throw new AppError('EXPORT_CANCELLED', '下载已中断', 409);
    if (this.output.writableNeedDrain)
      await new Promise<void>((resolve, reject) => {
        const clean = () => {
          this.output.off('drain', done);
          this.output.off('error', bad);
          this.output.off('close', closed);
        };
        const done = () => {
          clean();
          resolve();
        };
        const bad = (e: Error) => {
          clean();
          reject(e);
        };
        const closed = () => bad(new AppError('EXPORT_CANCELLED', '下载已中断', 409));
        this.output.once('drain', done);
        this.output.once('error', bad);
        this.output.once('close', closed);
      });
  }
  async finish(count: number, report?: ReportMeta | DerivedReportMeta, view?: ReportView): Promise<void> {
    await this.drain();
    const totals = this.totals();
    const row = this.sheet.addRow(
      this.config.fields.map((f, i) =>
        i === 0
          ? `合计（${count} ${this.config.rowUnit ?? '条'}）`
          : totals[f.key] === undefined
            ? ''
            : Number(totals[f.key]),
      ),
    );
    row.font = { name: 'Microsoft YaHei', size: 11, bold: true };
    row.commit();
    this.sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: count + 1, column: this.config.fields.length } };
    if (report) writeReconciliation(this.book, report);
    if (view) writeReportView(this.book, view);
    await Promise.race([this.book.commit(), this.completion]);
    if (this.failure) throw this.failure;
  }
  async abort(): Promise<void> {
    this.output.destroy();
    await this.completion.catch(() => undefined);
  }
}
