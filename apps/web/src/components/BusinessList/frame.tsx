import type { GlobalToken } from 'antd';
import { PageContainer } from '@ant-design/pro-components';
import { Card, PageShell } from '../ui';
import { spacing } from '../../theme/design-tokens';
import type { BusinessListConfig } from './config';
import type { BusinessListLayoutProps } from './layout';
import type { ReactNode } from 'react';

interface Props<Row> {
  config: BusinessListConfig<Row>;
  token: GlobalToken;
  filters: ReactNode;
  exportAction?: ReactNode;
  beforeResults?: ReactNode;
  results: ReactNode;
}

function FilterSurface({ design, token, children }: { design?: boolean; token: GlobalToken; children: ReactNode }) {
  if (design)
    return (
      <Card padding="large" testId="list-filters">
        {children}
      </Card>
    );
  return (
    <div
      className="business-list-filter"
      style={{
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        padding: token.padding,
        marginBottom: token.margin,
      }}
      data-testid="list-filters"
    >
      {children}
    </div>
  );
}

function DefaultPage<Row>({
  config,
  token,
  actions,
  children,
}: {
  config: BusinessListConfig<Row>;
  token: GlobalToken;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <PageContainer
      title={
        <h1 style={{ fontSize: token.fontSizeHeading4, margin: 0 }}>
          {config.icon && (
            <span style={{ fontSize: token.fontSizeLG, marginInlineEnd: token.marginXS }}>{config.icon}</span>
          )}
          {config.title}
        </h1>
      }
      content={config.description}
      extra={actions}
      className="business-list"
      token={{ paddingInlinePageContainerContent: token.paddingLG }}
      style={{ minWidth: 0, maxWidth: '100%' }}
    >
      {children}
    </PageContainer>
  );
}

function customLayoutProps<Row>(props: Props<Row>, action: ReactNode): BusinessListLayoutProps {
  const { config } = props;
  return {
    name: config.name,
    title: config.title,
    icon: config.icon,
    description: config.description,
    actions: config.exportInHeader ? (
      <>
        {config.extra}
        {action}
      </>
    ) : (
      action
    ),
    filters: props.filters,
    beforeResults: props.beforeResults,
    chart: config.chart,
    results: props.results,
  };
}

export function BusinessListFrame<Row>(props: Props<Row>) {
  const { config, token, filters, beforeResults, results, exportAction } = props;
  if (config.layout) {
    const Layout = config.layout;
    return <Layout {...customLayoutProps(props, exportAction)} />;
  }

  const content = (
    <>
      <FilterSurface design={config.designShell} token={token}>
        {filters}
      </FilterSurface>
      {beforeResults}
      {results}
    </>
  );
  if (config.designShell)
    return (
      <PageShell title={config.title} icon={config.icon} description={config.description} actions={exportAction}>
        <div className="business-list" style={{ display: 'grid', gap: spacing[16] }}>
          {content}
        </div>
      </PageShell>
    );
  return (
    <DefaultPage config={config} token={token} actions={exportAction}>
      {content}
    </DefaultPage>
  );
}
