import { Button } from 'antd';
import { EmptyState } from '../../components/ui';
import { auditCopy as t } from './text';
export function adjustAuditFilters() {
  const filters = document.getElementById('audit-filters');
  filters?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  filters?.querySelector<HTMLInputElement>('input')?.focus();
}
export function AuditEmpty() {
  return <EmptyState description={t.empty} action={<Button onClick={adjustAuditFilters}>{t.adjust}</Button>} />;
}
