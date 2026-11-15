import { theme } from 'antd';
import { listFields, tonnes, reconciliationLines, type ReportKind, type ReportMeta } from '@wms/contracts';
import type { ListTableSummary } from '../../components/BusinessList/table-summary';
import { spacing } from '../../theme/design-tokens';
import { reportInteractionCopy as copy } from './interaction-copy';

export function reportTableSummary<Row>(
  kind: ReportKind,
  data?: { report: ReportMeta; totals: Record<string, number | null> },
): ListTableSummary<Row> {
  const labelKey = listFields[kind].find((field) => !field.defaultHidden)?.key;
  return () =>
    Object.fromEntries([
      ...listFields[kind].map((field) => {
        const value = data?.totals[field.key];
        return [
          field.key,
          field.key === labelKey
            ? copy.filteredTotal
            : field.total === false || value == null
              ? copy.unknown
              : field.type === 'tonnes'
                ? tonnes(value)
                : String(value),
        ];
      }),
      ['__reconciliation', data ? <ReportFooter report={data.report} /> : undefined],
    ]);
}
function showReasons() {
  const element = document.getElementById('report-reconciliation-reasons');
  if (element instanceof HTMLDetailsElement) element.open = true;
}
function ReportFooter({ report }: { report: ReportMeta }) {
  const { token } = theme.useToken(),
    balance = report.reconciliation;
  const different =
    (balance.differenceGrams !== null && balance.differenceGrams !== 0) ||
    (balance.differencePackages !== null && balance.differencePackages !== 0);
  return (
    <div
      data-testid="report-table-reconciliation"
      style={{ display: 'flex', flexWrap: 'wrap', gap: spacing[8], color: token.colorText }}
    >
      <strong>{copy.fullReconciliation}</strong>
      {reconciliationLines(balance).map((line, index) => (
        <span key={line.label} style={{ color: index === 6 && different ? token.colorError : undefined }}>
          {line.label}：{line.packages === null ? copy.unknown : line.packages} 包 /{' '}
          {line.weightGrams === null ? copy.unknown : tonnes(line.weightGrams)} 吨
        </span>
      ))}
      {(different || balance.checkState === '不可验证') && (
        <a
          href="#report-reconciliation-reasons"
          onClick={showReasons}
          style={{ color: different ? token.colorError : token.colorLink }}
        >
          {copy.reasons}
        </a>
      )}
    </div>
  );
}
