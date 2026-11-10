import type { ExportKind } from '@wms/contracts';
import type { Key } from 'react';
import { batchText } from './batch-text';

export function documentNumber<Row extends { id: Key }>(name: ExportKind, row: Row): string {
  const value = name === 'inbound' ? (row as { receiptNo?: string }).receiptNo : (row as { orderNo?: string }).orderNo;
  return value ?? String(row.id);
}

export function isEligible<Row>(name: ExportKind, row: Row): boolean {
  if (name === 'inbound') return (row as { postingState?: string }).postingState === 'confirmed';
  if (name === 'outbound') return (row as { status?: string }).status === 'confirmed';
  return false;
}

export function exclusionReason<Row>(name: ExportKind, row: Row): string {
  const { status, postingState } = row as { status?: string; postingState?: string };
  const state = name === 'inbound' ? postingState : status;
  if (state === 'legacy' || ['audited', 'submit'].includes(status ?? '')) return batchText.history;
  if (state === 'reversed') return batchText.reversed;
  if (state === 'voided') return batchText.voided;
  if (state === 'pending' || state === 'open' || state === 'frozen') return batchText.pending;
  return batchText.unsupported;
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
