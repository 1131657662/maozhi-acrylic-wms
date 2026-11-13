import type { Writable } from 'node:stream';
import type { ExportKind, ListField } from '@wms/contracts';

export interface XlsxField extends Omit<ListField, 'type'> {
  type: ListField['type'] | 'kilograms';
}
export type XlsxConfig = ({ filename: string; stream?: never } | { stream: Writable; filename?: never }) & {
  kind?: ExportKind;
  fields: XlsxField[];
  rowUnit?: '条' | '行';
};
