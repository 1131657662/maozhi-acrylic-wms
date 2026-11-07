import { Tabs } from 'antd';
import { masterCatalogs } from './catalogs';
import { CatalogTable } from './catalog-table';

export function MasterDataPage() {
  return (
    <section>
      <div className="page-title">
        <div>
          <span className="eyebrow">REFERENCE DATA</span>
          <h1>主数据</h1>
          <p>维护业务单据使用的商品、仓库、客户和供应商。</p>
        </div>
        <span className="demo-label">合成数据 · 本地验证</span>
      </div>
      <Tabs
        items={masterCatalogs.map(({ key, label }) => ({ key, label, children: <CatalogTable catalog={key} /> }))}
      />
    </section>
  );
}
