import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Button, Card, Dropdown, Skeleton } from 'antd';
import type { CorrectionTarget, DateCorrectionHistory } from '@wms/contracts';
import { notifyError } from '../../api/error-events';
import { RequestError } from '../../components/RequestError';
import { dateCorrectionKeys } from './keys';
import { DateHistory } from './history';
import { DateCorrectionDrawer } from './drawer';
import { dateCorrectionCopy as text } from './copy';

export function DateCorrectionPanel({ target }: { target: CorrectionTarget }) {
  const client = useQueryClient(),
    query = useQuery(dateCorrectionKeys.history(target.kind, target.id));
  const [snapshot, setSnapshot] = useState<DateCorrectionHistory | null>(null);
  const [opening, setOpening] = useState(false);
  async function open() {
    setOpening(true);
    try {
      const current = await client.fetchQuery({ ...dateCorrectionKeys.history(target.kind, target.id), staleTime: 0 });
      if (!current.allowed) throw new Error(current.blockedReason ?? text.unavailable);
      setSnapshot(current);
    } catch (error) {
      notifyError(error);
    } finally {
      setOpening(false);
    }
  }
  if (query.isLoading)
    return (
      <div role="status" aria-label={text.loading}>
        <Skeleton active />
      </div>
    );
  if (query.error || !query.data)
    return (
      <RequestError
        type="error"
        error={query.error}
        action={<Button onClick={() => void query.refetch()}>{text.retry}</Button>}
      />
    );
  return (
    <Card
      title={text.title}
      data-testid="date-correction-panel"
      extra={
        query.data.allowed && (
          <Dropdown
            trigger={['click']}
            menu={{ items: [{ key: 'date', label: text.edit, onClick: () => void open() }] }}
          >
            <Button loading={opening}>{text.more}</Button>
          </Dropdown>
        )
      }
    >
      <DateHistory data={query.data} />
      {snapshot && <DateCorrectionDrawer target={target} initial={snapshot} onClose={() => setSnapshot(null)} />}
    </Card>
  );
}
