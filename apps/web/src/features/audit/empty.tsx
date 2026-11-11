import { Button, Empty } from 'antd';
import { auditCopy as t } from './text';
export function adjustAuditFilters() {
  const filters = document.getElementById('audit-filters');
  filters?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  filters?.querySelector<HTMLInputElement>('input')?.focus();
}
export function AuditEmpty() {
  return (
    <Empty description={t.empty}>
      <Button onClick={adjustAuditFilters}>{t.adjust}</Button>
    </Empty>
  );
}
