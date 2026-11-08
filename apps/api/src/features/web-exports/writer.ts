import ExcelJS from 'exceljs';
import { createWriteStream } from 'node:fs';
import { setImmediate as yieldLoop } from 'node:timers/promises';
import { listCellText, type ListField, type WebListKind } from '@wms/contracts';
import { AppError } from '../../shared/errors.ts';

const formats = { text: '@', integer: '0', tonnes: '0.0000', date: 'yyyy/mm/dd hh:mm:ss' };
const maxExcelInteger = 999_999_999_999_999;
export class XlsxWriter {
  private readonly output;
  private readonly book;
  private readonly sheet;
  private failure: Error | undefined;
  private sums = new Map<string, bigint>();
  constructor(readonly config: { filename: string; kind: WebListKind; fields: ListField[] }) {
    this.output = createWriteStream(config.filename, { flags: 'wx' });
    this.output.on('error', (e) => {
      this.failure = e;
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
    const display = this.config.fields.map((f) => listCellText(this.config.kind, f, row));
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
  private value(field: ListField, row: Record<string, unknown>, text: string): string | number | Date {
    if (field.type === 'date') return new Date(Date.parse(String(row[field.key])) + 8 * 3600_000);
    if (field.type === 'text') return text;
    const raw = Number(row[field.key]);
    if (!Number.isSafeInteger(raw) || Math.abs(raw) > maxExcelInteger)
      throw new AppError('EXPORT_PRECISION', '数值超出 Excel 15 位精度，未生成失真文件', 422);
    this.sums.set(field.key, (this.sums.get(field.key) ?? 0n) + BigInt(raw));
    return field.type === 'tonnes' ? raw / 1_000_000 : raw;
  }
  totals(): Record<string, string> {
    return Object.fromEntries(
      this.config.fields
        .filter((f) => this.sums.has(f.key))
        .map((f) => {
          const sum = this.sums.get(f.key)!;
          if (sum > BigInt(maxExcelInteger) || sum < -BigInt(maxExcelInteger))
            throw new AppError('EXPORT_PRECISION', '合计超出精确导出范围', 422);
          return [f.key, f.type === 'tonnes' ? (Number(sum) / 1_000_000).toFixed(4) : sum.toString()];
        }),
    );
  }
  async drain(): Promise<void> {
    await yieldLoop();
    if (this.failure) throw this.failure;
    if (this.output.writableNeedDrain)
      await new Promise<void>((resolve, reject) => {
        const clean = () => {
          this.output.off('drain', done);
          this.output.off('error', bad);
        };
        const done = () => {
          clean();
          resolve();
        };
        const bad = (e: Error) => {
          clean();
          reject(e);
        };
        this.output.once('drain', done);
        this.output.once('error', bad);
      });
  }
  async finish(count: number): Promise<void> {
    const totals = this.totals();
    const row = this.sheet.addRow(
      this.config.fields.map((f, i) =>
        i === 0 ? `合计（${count} 条）` : totals[f.key] === undefined ? '' : Number(totals[f.key]),
      ),
    );
    row.font = { name: 'Microsoft YaHei', size: 11, bold: true };
    row.commit();
    this.sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: count + 1, column: this.config.fields.length } };
    await this.book.commit();
    if (this.failure) throw this.failure;
  }
  async abort(): Promise<void> {
    this.output.destroy();
    if (!this.output.closed) await new Promise<void>((resolve) => this.output.once('close', () => resolve()));
  }
}
