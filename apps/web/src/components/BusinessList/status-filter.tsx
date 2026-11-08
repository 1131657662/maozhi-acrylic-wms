import { useQuery } from '@tanstack/react-query';
import { ProFormSelect } from '@ant-design/pro-components';
import { Button } from 'antd';
import { webListKeys } from '../../features/web-lists/keys';
import { StatusTag } from '../StatusTag';

export function StatusFilter({ kind, hidden }: { kind: 'inbound' | 'outbound'; hidden?: boolean }) {
  const { data: statuses, error: statusError, refetch: reload, isLoading } = useQuery(webListKeys.statuses(kind));
  return (
    <ProFormSelect
      name="statusChoice"
      hidden={hidden}
      label={kind === 'inbound' ? '原始状态' : '状态'}
      placeholder="全部状态"
      options={(statuses ?? []).map((status) => ({
        value: JSON.stringify(status),
        label: <StatusTag status={status} kind={kind} />,
      }))}
      fieldProps={{ loading: isLoading, 'aria-label': '状态筛选', allowClear: true }}
      extra={
        statusError ? (
          <Button type="link" onClick={() => void reload()}>
            状态选项加载失败，重试
          </Button>
        ) : undefined
      }
    />
  );
}
