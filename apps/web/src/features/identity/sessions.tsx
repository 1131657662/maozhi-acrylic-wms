import { App, Button, Table, Tag, Typography } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { AUTH_POLICY, auditChannelText, listTime, type AccountSession } from '@wms/contracts';
import { Card } from '../../components/ui/Card';
import { RequestError } from '../../components/RequestError';
import { identityCopy as t } from './copy';
import { identityKeys, useSessionRevoke } from './queries';

export function SessionsCard() {
  const query = useQuery(identityKeys.sessions);
  const revoke = useSessionRevoke();
  const { modal, message } = App.useApp();
  function confirm(row: AccountSession) {
    modal.confirm({
      title: t.revokeConfirm,
      content: row.isCurrent ? t.revokeCurrent : t.revokeDetail,
      okText: t.revoke,
      cancelText: t.cancel,
      okButtonProps: { danger: true },
      onOk: async () => {
        await revoke.mutateAsync(row.id);
        if (!row.isCurrent) void message.success(t.revoked);
      },
    });
  }
  return (
    <Card title={t.sessions} testId="identity-sessions">
      <Typography.Paragraph type="secondary">{t.sessionsHint}</Typography.Paragraph>
      {query.error && <RequestError error={query.error} retry={() => query.refetch()} />}
      {revoke.error && <RequestError error={revoke.error} />}
      <Table<AccountSession>
        rowKey="id"
        loading={query.isLoading}
        dataSource={query.data}
        pagination={{ pageSize: AUTH_POLICY.sessionPageSize, hideOnSinglePage: true, showSizeChanger: false }}
        columns={[
          { title: t.sessionChannel, dataIndex: 'channel', render: auditChannelText },
          { title: t.created, dataIndex: 'createdAt', render: listTime },
          { title: t.sessionExpires, dataIndex: 'expiresAt', render: listTime },
          { title: t.status, render: (_, row) => (row.isCurrent ? <Tag>{t.current}</Tag> : t.active) },
          {
            title: t.action,
            render: (_, row) => (
              <Button danger size="small" disabled={revoke.isPending} onClick={() => confirm(row)}>
                {t.revoke}
              </Button>
            ),
          },
        ]}
      />
    </Card>
  );
}
