import { Alert, Card, Descriptions, Space, Timeline } from 'antd';
import { tonnes, type CorrectionSummary } from '@wms/contracts';
import { formatTime } from '../../lib/format-time';

export function CorrectionSummaryPanel({
  summary,
  number,
  createdAt,
}: {
  summary: CorrectionSummary;
  number: string;
  createdAt: string;
}) {
  return (
    <Card title="更正与有效数量" data-testid="correction-summary">
      <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
        {summary.offset && <Alert type="info" title="原单已撤销，更正链已抵消，不再允许更正" />}
        <Descriptions
          column={2}
          items={[
            {
              key: 'original',
              label: '原单数量',
              children: `${summary.original.packages} 包 / ${tonnes(summary.original.weightGrams)} 吨`,
            },
            {
              key: 'effective',
              label: '有效数量',
              children: `${summary.effective.packages} 包 / ${tonnes(summary.effective.weightGrams)} 吨`,
            },
            {
              key: 'delta',
              label: '累计差额',
              children: `${summary.delta.packages >= 0 ? '+' : ''}${summary.delta.packages} 包 / ${summary.delta.weightGrams >= 0 ? '+' : ''}${tonnes(summary.delta.weightGrams)} 吨`,
            },
            {
              key: 'latest',
              label: '最近一次更正',
              children: summary.latest
                ? `${summary.latest.number} · ${formatTime(summary.latest.createdAt)}`
                : '尚无更正',
            },
          ]}
        />
        <Timeline
          items={[
            {
              key: 'original',
              content: `原单 ${number} · ${formatTime(createdAt)}：${summary.original.packages} 包 / ${tonnes(summary.original.weightGrams)} 吨`,
            },
            ...summary.records.map((record, index) => {
              const packages = record.lines.reduce((sum, line) => sum + line.delta.packages, 0);
              const grams = record.lines.reduce((sum, line) => sum + line.delta.weightGrams, 0);
              return {
                key: record.id,
                content: (
                  <div>
                    更正{index + 1} · 已被更正：{packages >= 0 ? '+' : ''}
                    {packages} 包（{record.number}，{formatTime(record.createdAt)}）
                    <div>
                      吨数差额：{grams >= 0 ? '+' : ''}
                      {tonnes(grams)} 吨；操作人：{record.actor}；原因：{record.reason}
                    </div>
                  </div>
                ),
              };
            }),
          ]}
        />
      </Space>
    </Card>
  );
}
