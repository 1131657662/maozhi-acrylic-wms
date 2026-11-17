import { Alert, Descriptions } from 'antd';
import { listTime, messageCopy as t, type MessageScan } from '@wms/contracts';
import { Card, SectionTitle } from '../../components/ui';

export function MessageScanHealth({ scan }: { scan: MessageScan }) {
  return (
    <Card testId="maintenance-health-messages" title={<SectionTitle title={t.scan} />}>
      {scan.reason && (
        <Alert
          type={scan.status === 'failed' || scan.status === 'interrupted' ? 'error' : 'info'}
          title={scan.reason}
        />
      )}
      <Descriptions
        column={1}
        items={[
          { key: 'time', label: t.scanTime, children: scan.at ? listTime(scan.at) : t.scanUnknown },
          { key: 'status', label: t.scanStatus, children: t.scanStatuses[scan.status] },
        ]}
      />
    </Card>
  );
}
