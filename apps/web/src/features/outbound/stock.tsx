import { Alert, Tag } from 'antd';
import { SourcePanel } from '../stock/source-panel';
export function Stock() {
  return (
    <section>
      <div className="page-title">
        <div>
          <span className="eyebrow">INVENTORY</span>
          <h1>库存概览</h1>
          <p>包数与总重量独立记录；只读查看确认后的库存。</p>
        </div>
        <Tag color="default" data-testid="stock-source-label">
          库存口径：ERP 商品
        </Tag>
      </div>
      <Alert
        type="info"
        showIcon
        title="库存与单据仅使用 ERP 商品"
        description="扫码目录记录条码、规格和实重，用于现场扫码核对，不计入库存。"
      />
      <SourcePanel />
    </section>
  );
}
