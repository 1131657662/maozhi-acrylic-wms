import { DatabaseOutlined } from '@ant-design/icons';
import { VehicleTable } from './vehicle-table';
import { masterCopy as t } from './copy';
import { Tabs } from 'antd';
import { masterCatalogs } from './catalogs';
import { CatalogTable } from './catalog-table';

export function MasterDataPage() {
  return (
    <section>
      <div className="page-title">
        <div>
          <h1>
            <DatabaseOutlined /> {t.title}
          </h1>
          <p>{t.description}</p>
        </div>
        <span className="demo-label">合成数据 · 本地验证</span>
      </div>
      <Tabs
        items={[
          ...masterCatalogs.map(({ key, label }) => ({ key, label, children: <CatalogTable catalog={key} /> })),
          { key: 'vehicles', label: t.vehicles, children: <VehicleTable /> },
        ]}
      />
    </section>
  );
}
