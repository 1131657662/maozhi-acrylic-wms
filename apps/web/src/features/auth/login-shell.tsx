import type { CSSProperties, ReactNode } from 'react';
import { Grid, theme } from 'antd';
import { LoginOutlined } from '@ant-design/icons';
import { Card, PageShell, SectionTitle } from '../../components/ui';
import { createDesignCssVariables } from '../../theme/design-tokens';
import { loginCopy as t } from './copy';

export function LoginShell({ children }: { children: ReactNode }) {
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const style = {
    ...createDesignCssVariables(token),
    '--wms-login-form-width': `${token.screenXS}px`,
    gridTemplateColumns: screens.lg ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)',
  } as CSSProperties;
  return (
    <main className="login-page" style={style}>
      <section className="login-intro">
        <PageShell title={t.productName} icon={<LoginOutlined />} description={t.englishName}>
          <div className="login-principles">
            {t.traceable}
            <br />
            {t.confirmed}
          </div>
          <div className="login-environment">{t.environment}</div>
        </PageShell>
      </section>
      <section className="login-card">
        <Card padding="large" title={<SectionTitle title={t.title} />}>
          {children}
        </Card>
      </section>
    </main>
  );
}
