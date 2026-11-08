import { Alert, Table, Tag, theme } from 'antd';
import { reconciliationLines, type ReportMeta, type ReportBalance } from '@wms/contracts';

function BalanceTable({ balance }: { balance: ReportBalance }) {
  const fields = reconciliationLines(balance);
  const columns = [
    { title: '对账单位', dataIndex: 'unit', width: 88 },
    ...fields.map((f, i) => ({ title: f.label, dataIndex: String(i), align: 'right' as const })),
  ];
  const rows = [
    {
      key: 'packages',
      unit: '包',
      ...Object.fromEntries(fields.map((f, i) => [i, f.packages === null ? '—' : String(f.packages)])),
    },
    {
      key: 'tonnes',
      unit: '吨',
      ...Object.fromEntries(
        fields.map((f, i) => [i, f.weightGrams === null ? '—' : (f.weightGrams / 1_000_000).toFixed(4)]),
      ),
    },
  ];
  return <Table size="small" pagination={false} columns={columns} dataSource={rows} tableLayout="fixed" />;
}
function BalanceNotice({ report }: { report: ReportMeta }) {
  const { token } = theme.useToken(),
    balance = report.reconciliation;
  return (
    <>
      <Alert
        style={{ marginTop: token.marginSM }}
        showIcon
        type={balance.checkState === '不可验证' || report.missingTime || report.unassignedRows ? 'warning' : 'success'}
        title={`${balance.checkState} · ${report.unverifiedCells} / ${report.totalCells} 个仓库商品单元不可验证`}
        description={`排除软删 ${report.excludedDeleted} 条；缺有效时间 ${report.missingTime} 条；来源未识别 ${report.unassignedRows} 条。期初/期末显示已观察边界，缺证据用“—”，不补零、不补调整。`}
      />
      {balance.reasons.length > 0 && (
        <details style={{ marginTop: token.marginSM }}>
          <summary>查看不可验证与差额原因（{balance.reasons.length} 项）</summary>
          <ul>
            {balance.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}
export function Reconciliation({ report }: { report: ReportMeta }) {
  const { token } = theme.useToken();
  return (
    <section
      aria-label="收发存对账"
      data-testid="report-reconciliation"
      style={{
        marginBottom: token.margin,
        background: token.colorBgContainer,
        borderRadius: token.borderRadiusLG,
        padding: token.padding,
      }}
    >
      <p style={{ marginTop: 0 }}>
        <Tag>ERP 商品 · 唯一库存口径</Tag>
        <Tag color={report.timeStatus === '时间未核实' ? 'warning' : undefined}>{report.timeStatus}</Tag>
        <strong>全部筛选区间对账</strong> · {report.fromDay} 至 {report.toDay} · 水位 {report.watermark}
      </p>
      <BalanceTable balance={report.reconciliation} />
      <BalanceNotice report={report} />
    </section>
  );
}
