import { DatabaseOutlined } from '@ant-design/icons';
import { VehicleTable } from './vehicle-table';
import { masterCopy as t } from './copy';
import { Tabs, theme } from 'antd';
import { masterCatalogs } from './catalogs';
import { CatalogTable } from './catalog-table';
import { PageShell } from '../../components/ui';
import { color, fontSize } from '../../theme/design-tokens';

export function MasterDataPage() {
  const { token } = theme.useToken();
  return (
    <PageShell
      title={t.title}
      icon={<DatabaseOutlined />}
      description={t.description}
      actions={<span style={{ color: color(token).textSecondary, fontSize: fontSize.auxiliary }}>{t.environment}</span>}
    >
      <Tabs
        items={[
          ...masterCatalogs.map(({ key, label }) => ({ key, label, children: <CatalogTable catalog={key} /> })),
          { key: 'vehicles', label: t.vehicles, children: <VehicleTable /> },
        ]}
      />
    </PageShell>
  );
}
