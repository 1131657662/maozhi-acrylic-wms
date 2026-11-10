import { useState, type Key } from 'react';
import type { ProColumns } from '@ant-design/pro-components';
import { Button, Space } from 'antd';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import type { WebMatchedLine } from '@wms/contracts';
import { MatchedLines, matchedSummary } from './matched-lines';

interface Matched {
  matchedLines?: WebMatchedLine[];
  matchedLineCount?: number;
}
export function useMatchedExpansion<Row extends { id: Key }>(columns: ProColumns<Row>[], enabled: boolean) {
  const [keys, setKeys] = useState<readonly Key[]>([]);
  const toggle = (id: Key) =>
    setKeys((current) => (current.includes(id) ? current.filter((key) => key !== id) : [...current, id]));
  return {
    columns: enabled
      ? columns.map((column) =>
          column.dataIndex !== 'matchedSummary'
            ? column
            : {
                ...column,
                render: (_: unknown, row: Row & Matched) => (
                  <Space size="small">
                    <Button
                      size="small"
                      type="text"
                      aria-label={keys.includes(row.id) ? '收起命中行' : '展开命中行'}
                      aria-expanded={keys.includes(row.id)}
                      icon={keys.includes(row.id) ? <DownOutlined /> : <RightOutlined />}
                      onClick={() => toggle(row.id)}
                    />
                    <span data-testid="matched-summary">{matchedSummary(row.matchedLines)}</span>
                  </Space>
                ),
              },
        )
      : columns,
    expandable: enabled
      ? {
          showExpandColumn: false,
          expandedRowKeys: keys,
          onExpandedRowsChange: setKeys,
          rowExpandable: (row: Row & Matched) => (row.matchedLineCount ?? 0) > 0,
          expandedRowRender: (row: Row & Matched) => <MatchedLines lines={row.matchedLines ?? []} />,
        }
      : undefined,
  };
}
