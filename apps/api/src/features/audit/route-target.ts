import type { AttemptTarget, AuditChannel } from './context.ts';
import { auditCode } from './input-summary.ts';

type Match = RegExpMatchArray;
interface RouteRule {
  pattern: RegExp;
  action: (m: Match, method: string) => string;
  kind: string | ((m: Match) => string);
  id?: number;
  channel?: AuditChannel;
}
const routes: RouteRule[] = [
  {
    pattern: /^\/outbound\/([^/]+)\/(shipments|complete|short-close|plan)$/,
    action: (m, method) =>
      method === 'GET'
        ? 'outbound.read'
        : m[2] === 'plan'
          ? 'outbound.plan.update'
          : m[2] === 'shipments'
            ? 'outbound.confirm'
            : `outbound.${m[2]}`,
    kind: 'outbound',
    id: 1,
    channel: 'web',
  },
  {
    pattern: /^\/outbound\/([^/]+)\/scan-records(?:\/[^/]+)?$/,
    action: (_, method) => (method === 'DELETE' ? 'scan.revoke' : 'scan.record'),
    kind: 'outbound',
    id: 1,
    channel: 'web',
  },
  {
    pattern: /^\/outbound\/([^/]+)\/scan-reopen$/,
    action: () => 'scan.reopen',
    kind: 'outbound',
    id: 1,
    channel: 'web',
  },
  { pattern: /^\/auth\/(login|logout|me)$/, action: (m) => `auth.${m[1]}`, kind: 'account' },
  {
    pattern: /^\/(inbound|outbound)\/([^/]+)\/(confirm|reverse|void|corrections|business-date)$/,
    action: (m) =>
      m[3] === 'corrections' ? 'stock.correct' : m[3] === 'business-date' ? `business-date.${m[1]}` : `${m[1]}.${m[3]}`,
    kind: (m) => m[1]!,
    id: 2,
    channel: 'web',
  },
  {
    pattern: /^\/(inbound|outbound)(?:\/([^/]+))?$/,
    action: (m, method) =>
      method === 'POST'
        ? m[1] === 'outbound'
          ? 'outbound.plan.create'
          : 'inbound.create'
        : method === 'PATCH'
          ? 'outbound.plan.update'
          : `${m[1]}.read`,
    kind: (m) => m[1]!,
    id: 2,
  },
  {
    pattern: /^\/scan\/plans\/([^/]+)\/(facts|submit)$/,
    action: (m) => (m[2] === 'facts' ? 'scan.record' : 'scan.freeze'),
    kind: 'outbound',
    id: 1,
    channel: 'pda',
  },
  { pattern: /^\/web\/lifecycle\/batch-reverse$/, action: () => 'batch.reverse', kind: 'batch', channel: 'web' },
  { pattern: /^\/stock\/adjustments$/, action: () => 'stock.adjust', kind: 'stock', channel: 'web' },
  {
    pattern: /^\/stocktakes(?:\/([^/]+))?(?:\/(post|void|lines)(?:\/[^/]+)?)?$/,
    action: (m, method) =>
      method === 'GET' ? 'stocktake.read' : `stocktake.${m[2] === 'lines' ? 'reading' : (m[2] ?? 'create')}`,
    kind: 'stocktake',
    id: 1,
    channel: 'web',
  },
  {
    pattern: /^\/catalog\/versions\/([^/]+)\/publish$/,
    action: () => 'catalog.publish',
    kind: 'catalog',
    id: 1,
    channel: 'web',
  },
  { pattern: /^\/catalog\/uploads$/, action: () => 'catalog.upload', kind: 'catalog', channel: 'web' },
  {
    pattern: /^\/(scan|catalog)\/handoffs(?:\/([^/]+))?(?:\/(records|bind|clients|confirm))?$/,
    action: (m) => `catalog.handoff.${m[3] === 'clients' ? 'link' : (m[3] ?? 'register')}`,
    kind: 'handoff',
    id: 2,
  },
  {
    pattern: /^\/(?:master|master-data)\/contacts(?:\/([^/]+))?(?:\/(default))?$/,
    action: (m, method) => `contact.${m[2] ?? verb(method)}`,
    kind: 'contact',
    id: 1,
    channel: 'web',
  },
  {
    pattern: /^\/(?:master|master-data)\/vehicles(?:\/([^/]+))?$/,
    action: (_, method) => `vehicle.${verb(method)}`,
    kind: 'vehicle',
    id: 1,
    channel: 'web',
  },
  {
    pattern: /^\/(?:master|master-data)\/([^/]+)(?:\/([^/]+))?$/,
    action: (_, method) => `master.${verb(method)}`,
    kind: (m) =>
      ['customers', 'suppliers', 'warehouses', 'products', 'categories'].includes(m[1]!) ? `master.${m[1]}` : 'master',
    id: 2,
    channel: 'web',
  },
  {
    pattern: /^\/web\/exports(?:\/([^/]+))?(?:\/(cancel|download))?$/,
    action: (m, method) => `export.${m[2] ?? (method === 'POST' ? 'generate' : 'read')}`,
    kind: 'export',
    id: 1,
    channel: 'web',
  },
];
function verb(method: string): string {
  return { POST: 'create', PUT: 'update', PATCH: 'update', DELETE: 'delete' }[method] ?? 'read';
}
function routeChannel(path: string, method: string): AuditChannel | null {
  if (/^\/scan\/handoffs/.test(path)) return 'pda';
  if (/^\/(web|master|master-data|stocktakes|catalog|inbound|reports|document-numbering|me)\b/.test(path)) return 'web';
  if (/^\/outbound\b/.test(path) && method !== 'GET') return 'web';
  return null;
}
export function auditRoute(method: string, originalPath: string): AttemptTarget {
  const path = originalPath.replace(/^\/api\/v1/, '');
  for (const rule of routes) {
    const match = path.match(rule.pattern);
    if (match) {
      const targetKind = typeof rule.kind === 'string' ? rule.kind : rule.kind(match);
      const id = rule.id ? auditCode(match[rule.id]) : null;
      const targetId = id && targetKind.startsWith('master.') ? `${targetKind.slice(7)}:${id}` : id;
      return {
        action: rule.action(match, method),
        targetKind,
        targetId,
        channel: rule.channel ?? routeChannel(path, method),
      };
    }
  }
  return {
    action: method === 'GET' ? 'request.read' : 'request.write',
    targetKind: null,
    targetId: null,
    channel: routeChannel(path, method),
  };
}
