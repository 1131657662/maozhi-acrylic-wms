import { Button, Dropdown, Space } from 'antd';
import type { CorrectionKind } from '@wms/contracts';
import { ListDetailLink } from '../../components/BusinessList/navigation';
import { CorrectionDrawer } from './drawer';
import { useOpenCorrection } from './use-open-correction';

export function CorrectionRowActions({
  kind,
  id,
  number,
  eligible,
}: {
  kind: CorrectionKind;
  id: string;
  number: string;
  eligible: boolean;
}) {
  const target = { kind, id },
    correction = useOpenCorrection(target);
  return (
    <>
      <Space>
        <ListDetailLink to={`/${kind}/${id}`}>查看详情</ListDetailLink>
        <Dropdown
          trigger={['click']}
          menu={{
            items: [{ key: 'correct', label: '数量更正', disabled: !eligible }],
            onClick: () => void correction.open(),
          }}
        >
          <Button type="link" loading={correction.loading}>
            更多 ▾
          </Button>
        </Dropdown>
      </Space>
      {correction.snapshot && (
        <CorrectionDrawer target={target} number={number} initial={correction.snapshot} onClose={correction.close} />
      )}
    </>
  );
}
