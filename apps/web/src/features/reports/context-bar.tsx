import { Alert, theme } from 'antd';
import type { ReportMeta, ReportView } from '@wms/contracts';
import { businessCopy } from '../../business-copy';

type ReportSnapshot = Pick<ReportView, 'basis' | 'balanceMode' | 'watermarks' | 'restatedBalance'> & {
  report?: Pick<ReportMeta, 'reconciliation'>;
};
type ReportBasis = ReportView['basis'];

function localTimestamp(asOf: string): string {
  const timestamp = Date.parse(asOf);
  if (Number.isNaN(timestamp)) return asOf;
  return new Date(timestamp + 8 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
}

function unverifiableReasons(view: ReportSnapshot): string[] {
  return view.restatedBalance?.reasons ?? view.report?.reconciliation.reasons ?? [];
}

function BalanceWarning({ view }: { view?: ReportSnapshot }) {
  if (!view || view.balanceMode !== 'unverifiable') return null;
  const reasons = unverifiableReasons(view);
  return (
    <Alert
      showIcon
      type="warning"
      title={businessCopy.reportsBalanceUnverifiable}
      description={reasons.length ? reasons.join('；') : businessCopy.reportsBalanceReasonMissing}
      data-testid="report-unverifiable-notice"
    />
  );
}

function ReportWatermarks({ view, status, gap }: { view?: ReportSnapshot; status: string; gap: number }) {
  const asOf = view ? localTimestamp(view.watermarks.asOf) : status,
    journalMaxId = view?.watermarks.journalMaxId ?? status,
    dateCorrectionMaxId = view
      ? (view.watermarks.dateCorrectionMaxId ?? businessCopy.reportsNoDateCorrections)
      : status;
  return (
    <div data-testid="report-watermarks" style={{ display: 'flex', flexWrap: 'wrap', gap }}>
      <span>
        {businessCopy.reportsAsOf} {asOf}（{businessCopy.reportsShanghaiTime}）
      </span>
      <span>
        {businessCopy.reportsJournalWatermark} {journalMaxId}
      </span>
      <span>
        {businessCopy.reportsDateCorrectionWatermark} {dateCorrectionMaxId}
      </span>
    </div>
  );
}

export function ReportContextBar({
  view,
  basis,
  pending = false,
  unavailable = false,
}: {
  view?: ReportSnapshot;
  basis: ReportBasis;
  pending?: boolean;
  unavailable?: boolean;
}) {
  const { token } = theme.useToken();
  const currentBasis = view?.basis ?? basis,
    basisLabel = currentBasis === 'restated' ? businessCopy.reportsBasisRestated : businessCopy.reportsBasisPosted,
    status = pending
      ? businessCopy.reportsSnapshotLoading
      : unavailable
        ? businessCopy.reportsSnapshotUnavailable
        : businessCopy.reportsSnapshotUnknown;

  return (
    <section
      aria-label={businessCopy.reportsContextLabel}
      data-testid="report-context-bar"
      style={{
        display: 'grid',
        gap: token.marginSM,
        padding: token.paddingSM,
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusSM,
        background: token.colorBgContainer,
      }}
    >
      <div data-testid="report-basis-label">
        <strong>{businessCopy.reportsCurrentBasis}</strong>
        {basisLabel}
      </div>
      <ReportWatermarks view={view} status={status} gap={token.margin} />
      <BalanceWarning view={view} />
    </section>
  );
}
