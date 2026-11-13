import { RequestError } from '../../components/RequestError';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Radio, Space } from 'antd';
import { ProTable, type ProColumns } from '@ant-design/pro-components';
import { CATALOG_DIFF_PAGE_SIZE, type CatalogDiffRow, type CatalogVersion } from '@wms/contracts';
import { catalogKeys } from './keys';
import { EmptyState } from '../../components/ui';
import { catalogReadCopy as copy } from './export-copy';

const weight = (grams: number | null) =>
  grams === null ? '—' : `${grams / 1000} kg / ${(grams / 1000000).toFixed(4)} 吨`;
const columns: ProColumns<CatalogDiffRow>[] = [
  { title: copy.barcode, dataIndex: 'barcode', fixed: 'left', width: 180 },
  {
    title: copy.change,
    dataIndex: 'kind',
    width: 80,
    render: (_, row) =>
      row.kind === 'changed'
        ? [row.weightChanged && copy.weightChanged, row.specChanged && copy.specChanged].filter(Boolean).join('、')
        : { added: copy.added, removed: copy.removed, unchanged: copy.unchanged }[row.kind],
  },
  {
    title: copy.specChange,
    width: 280,
    render: (_, row) => (
      <>
        {row.oldSpec ?? '—'}
        <br />→ {row.newSpec ?? '—'}
      </>
    ),
  },
  {
    title: copy.weightChange,
    width: 300,
    render: (_, row) => (
      <>
        {weight(row.oldWeightGrams)}
        <br />→ {weight(row.newWeightGrams)}
      </>
    ),
  },
];
export function DiffPreview({ version, against }: { version: CatalogVersion; against?: number }) {
  const [kind, setKind] = useState('all');
  const [cursors, setCursors] = useState(['']);
  const {
    data: diff,
    error,
    isFetching,
    refetch,
  } = useQuery(catalogKeys.diff(version.versionId, kind, cursors.at(-1)!, against));
  const options = [
    { label: copy.allDiff, value: 'all' },
    { label: copy.added, value: 'added' },
    { label: copy.removed, value: 'removed' },
    { label: copy.weightChanged, value: 'weight' },
    { label: copy.specChanged, value: 'spec' },
    { label: copy.unchanged, value: 'unchanged' },
  ];
  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Radio.Group
        aria-label={copy.diffKind}
        options={options}
        value={kind}
        onChange={(e) => {
          setKind(e.target.value);
          setCursors(['']);
        }}
      />
      {error && (
        <RequestError
          type="error"
          error={error}
          action={<Button onClick={() => void refetch()}>{copy.retryDiff}</Button>}
        />
      )}
      <ProTable<CatalogDiffRow>
        rowKey="barcode"
        headerTitle={copy.comparison(diff ? diff.baseVersionId : (against ?? version.baseVersionId), version.versionId)}
        search={false}
        options={false}
        columns={columns}
        dataSource={diff?.items ?? []}
        loading={isFetching}
        pagination={false}
        scroll={{ x: 840 }}
        locale={{ emptyText: <EmptyState description={copy.noDiff} /> }}
      />
      <Space wrap>
        <span>{copy.diffCount(diff?.total)}</span>
        <Button disabled={cursors.length === 1 || isFetching} onClick={() => setCursors(cursors.slice(0, -1))}>
          {copy.previous}
        </Button>
        <Button
          disabled={!diff?.items.length || cursors.length * CATALOG_DIFF_PAGE_SIZE >= diff.total || isFetching}
          onClick={() => setCursors([...cursors, diff!.items.at(-1)!.barcode])}
        >
          {copy.next}
        </Button>
      </Space>
    </Space>
  );
}
