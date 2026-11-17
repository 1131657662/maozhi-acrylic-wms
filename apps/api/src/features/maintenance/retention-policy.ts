import { MAINTENANCE, type BackupArtifact } from '@wms/contracts';

export function retentionPlan(items: BackupArtifact[], now: number): { keep: Set<string>; monthly: Set<string> } {
  const current = new Date(now + MAINTENANCE.shanghaiOffsetMs);
  const monthIndex = current.getUTCFullYear() * 12 + current.getUTCMonth();
  const firstMonth = monthIndex - MAINTENANCE.monthlyMonths + 1;
  const keep = new Set<string>(),
    monthly = new Set<string>(),
    months = new Set<number>();
  const ordered = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
  for (const item of ordered) {
    const at = Date.parse(item.createdAt),
      date = new Date(at + MAINTENANCE.shanghaiOffsetMs);
    const month = date.getUTCFullYear() * 12 + date.getUTCMonth();
    if (at >= now - MAINTENANCE.dailyDays * MAINTENANCE.dayMs) keep.add(item.id);
    if (month < firstMonth || month > monthIndex || months.has(month)) continue;
    months.add(month);
    monthly.add(item.id);
    keep.add(item.id);
  }
  return { keep, monthly };
}
