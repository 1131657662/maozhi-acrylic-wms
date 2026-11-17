import { messageCopy as t, type MessageType } from '@wms/contracts';
import type { Row } from '../../db/mysql.ts';
import { businessText } from '../audit/projection.ts';
import { hash } from '../../shared/hash.ts';

export interface Candidate {
  type: MessageType;
  objectType: string;
  objectId: string;
  eventKey: string;
  anchor: string;
  title: string;
  body: string;
  linkPath: string;
}
function destination(kind: string, id: string): string {
  if (kind === 'inbound' || kind === 'outbound') return `/${kind}/${encodeURIComponent(id)}`;
  if (kind === 'stocktake') return `/stocktakes/${encodeURIComponent(id)}`;
  if (kind === 'catalog') return '/catalog';
  if (kind === 'stock') return '/stock';
  return '/maintenance';
}
function content(type: MessageType, row: Row): [string, string] {
  const name = businessText(row.name, t.numberMissing);
  switch (type) {
    case 'pending':
      return row.object_type === 'inbound'
        ? [t.inbound(name), t.pendingInbound]
        : [t.outbound(name), t.pendingOutbound];
    case 'shipment_overdue':
      return [t.overdue(name), t.overdueBody];
    case 'stocktake_overdue':
      return [t.stocktake(name), t.stocktakeBody];
    case 'catalog_stale':
      return [t.catalog, t.catalogBody];
    case 'backup_failed':
      return [t.backup, t.backupBody];
    case 'anomaly':
      return row.object_type === 'stock' ? [t.stock, t.stockBody] : [t.difference(name), t.differenceBody];
  }
}
export function candidate(type: MessageType, row: Row): Candidate {
  const objectType = String(row.object_type),
    objectId = String(row.id),
    [title, body] = content(type, row);
  return {
    type,
    objectType,
    objectId,
    eventKey: hash(JSON.stringify([type, objectType, objectId])),
    anchor: String(row.anchor),
    title,
    body,
    linkPath: destination(objectType, objectId),
  };
}
