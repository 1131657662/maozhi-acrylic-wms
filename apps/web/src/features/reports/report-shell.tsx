import { PrinterOutlined } from '@ant-design/icons';
import { Button, Tooltip, theme } from 'antd';
import type { BusinessListLayoutProps } from '../../components/BusinessList/layout';
import { PageShell } from '../../components/ui';
import { spacing } from '../../theme/design-tokens';
import { businessCopy } from '../../business-copy';
import { ReportFavoriteButton } from './report-favorite';

export function ReportShell({
  name,
  title,
  icon,
  description,
  actions,
  filters,
  beforeResults,
  chart,
  results,
}: BusinessListLayoutProps) {
  const { token } = theme.useToken();
  return (
    <PageShell
      title={title}
      icon={icon}
      description={description}
      actions={
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: spacing[8],
            flexWrap: 'wrap',
          }}
        >
          <ReportFavoriteButton report={name} />
          <Tooltip title={businessCopy.reportsPrintUnavailable}>
            <span>
              <Button aria-label={businessCopy.reportsPrintUnavailable} disabled icon={<PrinterOutlined />} />
            </span>
          </Tooltip>
          {actions}
        </div>
      }
    >
      <div style={{ display: 'grid', gap: spacing[16], minWidth: 0 }}>
        <section
          aria-label={businessCopy.reportsFiltersLabel}
          data-testid="report-filter-section"
          style={{
            background: token.colorBgContainer,
            border: `1px solid ${token.colorBorderSecondary}`,
            borderRadius: token.borderRadiusLG,
            padding: token.padding,
          }}
        >
          {filters}
        </section>
        {beforeResults}
        {chart && (
          <section aria-label={businessCopy.reportsChartLabel} data-testid="report-chart-slot">
            {chart}
          </section>
        )}
        {results}
      </div>
    </PageShell>
  );
}
