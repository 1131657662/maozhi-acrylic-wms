import type { ExportKind } from '@wms/contracts';
import type { Key } from 'react';

export function documentNumber<Row extends { id: Key }>(name: ExportKind, row: Row): string {
  const value = name === 'inbound' ? (row as { receiptNo?: string }).receiptNo : (row as { orderNo?: string }).orderNo;
  return value ?? String(row.id);
}

export function isEligible<Row>(name: ExportKind, row: Row): boolean {
  if (name === 'inbound') return (row as { postingState?: string }).postingState === 'confirmed';
  if (name === 'outbound') return (row as { status?: string }).status === 'confirmed';
  return false;
}

export function isInteractiveTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && Boolean(target.closest('a,button,input,textarea,[role="button"]'));
}

export function isTextEntry(target: EventTarget | null): boolean {
  return (
    (target instanceof HTMLInputElement && target.type !== 'checkbox') ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement
  );
}
