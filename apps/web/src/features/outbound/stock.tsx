import { useState } from 'react';
import { Alert, Tabs, Tag } from 'antd';
import { stockSourceSchema, type StockSource } from '@wms/contracts';
import { sourceLabels } from '../stock/source-labels';
import { SourcePanel } from '../stock/source-panel';
export function Stock() {
  const [source, setSource] = useState<StockSource>('erp-product');
  return (
    <section>
      <div className="page-title">
        <div>
          <span className="eyebrow">INVENTORY</span>
          <h1>库存概览</h1>
          <p>包数与总重量独立记录；只读查看确认后的库存。</p>
        </div>
        <Tag color="default" data-testid="stock-source-label">
          当前来源：{sourceLabels[source]}
        </Tag>
      </div>
      <Alert
        type="info"
        showIcon
        title="ERP 与 SPEC 未建立可靠映射，分别查看，不提供跨来源合计"
        description="以下小计、明细和流水仅属于当前来源；切换来源不会累加。条码目录本身不计入库存。"
      />
      <Tabs
        activeKey={source}
        onChange={(key) => setSource(stockSourceSchema.parse(key))}
        items={stockSourceSchema.options.map((key) => ({ key, label: sourceLabels[key] }))}
      />
      <SourcePanel key={source} source={source} />
    </section>
  );
}
