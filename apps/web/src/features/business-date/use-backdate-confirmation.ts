import { App } from 'antd';
import { backdateThreshold, shanghaiToday } from '@wms/contracts';

export function useBackdateConfirmation() {
  const { modal } = App.useApp();
  return async (businessDate?: string): Promise<boolean> => {
    if (!businessDate || businessDate >= backdateThreshold(shanghaiToday())) return true;
    return Boolean(
      await modal.confirm({
        title: '确认回填超过 3 个月的业务日期？',
        content: `业务日期为 ${businessDate}；登记与入账时间不变。此确认会记入审计日志。`,
        okText: '确认回填',
        cancelText: '返回核对',
        okButtonProps: { type: 'default' },
      }),
    );
  };
}
