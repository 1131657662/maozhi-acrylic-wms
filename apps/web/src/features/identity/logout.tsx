import { App, Button, Typography } from 'antd';
import { Card } from '../../components/ui/Card';
import { RequestError } from '../../components/RequestError';
import { useLogout } from '../auth/use-logout';
import { identityCopy as t } from './copy';

export function LogoutCard() {
  const logout = useLogout();
  const { modal } = App.useApp();
  return (
    <Card title={t.logoutTitle}>
      <Typography.Paragraph type="secondary">{t.logoutDetail}</Typography.Paragraph>
      {logout.error && <RequestError error={logout.error} />}
      <Button
        danger
        loading={logout.isPending}
        onClick={() =>
          modal.confirm({
            title: t.logoutConfirm,
            content: t.logoutDetail,
            okText: t.logout,
            cancelText: t.cancel,
            okButtonProps: { danger: true },
            onOk: () => logout.mutateAsync(),
          })
        }
      >
        {t.logout}
      </Button>
    </Card>
  );
}
