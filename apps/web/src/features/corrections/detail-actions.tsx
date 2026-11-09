import { Button, Card, Space, Tooltip } from 'antd';
import type { CorrectionKind } from '@wms/contracts';
import { CorrectionDrawer } from './drawer';
import { useOpenCorrection } from './use-open-correction';

export function CorrectionDetailActions({
  kind,
  id,
  number,
  allowed,
}: {
  kind: CorrectionKind;
  id: string;
  number: string;
  allowed: boolean;
}) {
  const target = { kind, id },
    correction = useOpenCorrection(target);
  return (
    <Card title="单据操作" data-testid="document-bottom-actions">
      <Space>
        <Button
          type={allowed ? 'primary' : 'default'}
          disabled={!allowed}
          loading={correction.loading}
          onClick={() => void correction.open()}
        >
          数量更正
        </Button>
        <Tooltip title="待接入积木报表">
          <span>
            <Button disabled>打印</Button>
          </span>
        </Tooltip>
      </Space>
      {correction.snapshot && (
        <CorrectionDrawer target={target} number={number} initial={correction.snapshot} onClose={correction.close} />
      )}
    </Card>
  );
}
