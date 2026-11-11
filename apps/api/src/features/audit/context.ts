import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

export type AuditChannel = 'web' | 'pda' | 'miniapp';
export interface AuditIdentity {
  username: string;
  traceId: string;
  channel?: AuditChannel;
}
export interface AttemptTarget {
  action: string;
  targetKind: string | null;
  targetId: string | null;
  channel: AuditChannel | null;
}
export interface AttemptContext extends AttemptTarget {
  attemptId: string;
  traceId: string;
  actor: string | null;
  input: unknown;
  phase: 'not_started' | 'started' | 'rolled_back' | 'committed' | 'unknown';
  committed: boolean;
  persistence?: Promise<boolean>;
}
export const auditContext = new AsyncLocalStorage<AttemptContext | undefined>();

export function newAttempt(target: AttemptTarget, traceId: string): AttemptContext {
  return {
    ...target,
    attemptId: randomUUID(),
    traceId,
    actor: null,
    input: {},
    phase: 'not_started',
    committed: false,
  };
}
export function identifyAuditActor(identity: AuditIdentity): void {
  const context = auditContext.getStore();
  if (!context) return;
  context.actor = identity.username;
  if (identity.channel) context.channel = identity.channel;
}
export function observeAuditTransaction(phase: AttemptContext['phase']): void {
  const context = auditContext.getStore();
  if (!context) return;
  context.phase = phase;
  if (phase === 'committed') context.committed = true;
}
