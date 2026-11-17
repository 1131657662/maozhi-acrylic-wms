import { Tooltip } from 'antd';
import { Link } from '@umijs/max';
import { QuestionCircleOutlined } from '@ant-design/icons';
import { StatCard } from '../../components/ui';
import { spacing } from '../../theme/design-tokens';
import { chartCopy as copy } from './chart-copy';

export interface ReportStat {
  label: string;
  value: string;
  formula: string;
}
export function ReportStatCards({ stats, hrefs }: { stats: ReportStat[]; hrefs?: string[] }) {
  return (
    <section
      aria-label={copy.cards}
      data-testid="report-stat-cards"
      style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`, gap: spacing[16] }}
    >
      {stats.map((stat, index) => (
        <StatCard
          key={stat.label}
          value={hrefs?.[index] ? <Link to={hrefs[index]}>{stat.value}</Link> : stat.value}
          label={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: spacing[4] }}>
              {stat.label}
              <Tooltip title={stat.formula} trigger={['hover', 'focus']}>
                <span tabIndex={0} aria-label={`${stat.label} · ${copy.help}`}>
                  <QuestionCircleOutlined />
                </span>
              </Tooltip>
            </span>
          }
        />
      ))}
    </section>
  );
}
