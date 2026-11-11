import { auditContext } from './context.ts';
import { auditObject, auditCode } from './input-summary.ts';

export interface AuditEntry {
  action: string;
  targetId: string;
  before: unknown;
  after: unknown;
}
export function eventMetadata(entry: AuditEntry) {
  const before = auditObject(entry.before),
    after = auditObject(entry.after);
  const value = { ...before, ...after };
  const context = auditContext.getStore();
  const kind = entry.action.startsWith('scan.')
    ? 'outbound'
    : entry.action.startsWith('master.')
      ? `master.${entry.targetId.split(':')[0]}`
      : entry.action.startsWith('stock.correct')
        ? 'correction'
        : entry.action.startsWith('stock.adjust')
          ? 'inventory_operation'
          : entry.action.startsWith('catalog.handoff')
            ? 'handoff'
            : entry.action.split('.')[0]!;
  const result =
    entry.action === 'export.failed' ? 'failed' : entry.action === 'export.cancelled' ? 'cancelled' : 'success';
  return {
    kind: context?.targetId === entry.targetId ? context.targetKind : kind,
    number: auditCode(value.receiptNo) ?? auditCode(value.orderNo) ?? auditCode(value.number) ?? auditCode(value.code),
    result,
    effect: result === 'success' ? 'applied' : 'not_applied',
  };
}
