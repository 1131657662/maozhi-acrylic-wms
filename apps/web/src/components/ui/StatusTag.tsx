import type { ReactNode } from 'react';
import { Tag, theme } from 'antd';
import { statusColors, type StatusTone } from '../../theme/design-tokens';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';

export type StatusTagType = StatusTone;

const appearance: Record<StatusTagType, { color?: StatusTagType; icon: ReactNode }> = {
  default: { icon: <InfoCircleOutlined /> },
  processing: { color: 'processing', icon: <ClockCircleOutlined /> },
  success: { color: 'success', icon: <CheckCircleOutlined /> },
  warning: { color: 'warning', icon: <ExclamationCircleOutlined /> },
  error: { color: 'error', icon: <CloseCircleOutlined /> },
};

export function StatusTag({ status, type = 'default' }: { status: string; type?: StatusTagType }) {
  const { token } = theme.useToken();
  const style = appearance[type];
  return (
    <Tag color={style.color} icon={style.icon} style={statusColors(token)[type]} data-testid="design-status-tag">
      {status}
    </Tag>
  );
}
