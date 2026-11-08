import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button, Empty, Radio, Space } from 'antd';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import type { CatalogDiffRow, CatalogVersion } from '@wms/contracts';
import { catalogKeys } from './keys';

const weight = (grams: number | null) =>
  grams === null ? '—' : `${grams / 1000} kg / ${(grams / 1000000).toFixed(4)} 吨`;
const columns: ProColumns<CatalogDiffRow>[] = [
  { title: '条码', dataIndex: 'barcode', fixed: 'left', width: 180 },
  {
    title: '变化',
    dataIndex: 'kind',
    width: 80,
    valueEnum: { added: '新增', removed: '消失', changed: '变更', unchanged: '未变' },
  },
  {
    title: '原规格 → 新规格',
    width: 280,
    render: (_, row) => (
      <>
        {row.oldSpec ?? '—'}
        <br />→ {row.newSpec ?? '—'}
      </>
    ),
  },
  {
    title: '原重量 → 新重量',
    width: 300,
    render: (_, row) => (
      <>
        {weight(row.oldWeightGrams)}
        <br />→ {weight(row.newWeightGrams)}
      </>
    ),
  },
];
export function DiffPreview({ version }: { version: CatalogVersion }) {
  const [kind, setKind] = useState('all');
  const [cursors, setCursors] = useState(['']);
  const {
    data: diff,
    error,
    isFetching,
    refetch,
  } = useQuery(catalogKeys.diff(version.versionId, kind, cursors.at(-1)!));
  const options = [
    { label: '全部差异与条目', value: 'all' },
    { label: '新增', value: 'added' },
    { label: '消失', value: 'removed' },
    { label: '重量变更', value: 'weight' },
    { label: '规格变更', value: 'spec' },
  ];
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Radio.Group
        aria-label="差异类型"
        options={options}
        value={kind}
        onChange={(e) => {
          setKind(e.target.value);
          setCursors(['']);
        }}
      />
      {error && (
        <Alert
          type="error"
          title={error.message}
          action={<Button onClick={() => void refetch()}>重试差异查询</Button>}
        />
      )}
      <ProTable<CatalogDiffRow>
        rowKey="barcode"
        headerTitle={`第 ${version.baseVersionId} → ${version.versionId} 版差异`}
        search={false}
        options={false}
        columns={columns}
        dataSource={diff?.items ?? []}
        loading={isFetching}
        pagination={false}
        scroll={{ x: 840 }}
        locale={{ emptyText: <Empty description="该类没有差异条目" /> }}
      />
      <Space wrap>
        <span>共 {diff?.total ?? '…'} 条 · 每页最多 50 条</span>
        <Button disabled={cursors.length === 1 || isFetching} onClick={() => setCursors(cursors.slice(0, -1))}>
          上一页
        </Button>
        <Button
          disabled={!diff || cursors.length * 50 >= diff.total || isFetching}
          onClick={() => setCursors([...cursors, diff!.items.at(-1)!.barcode])}
        >
          下一页
        </Button>
      </Space>
    </Space>
  );
}
