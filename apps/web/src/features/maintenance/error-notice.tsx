import { Alert, Button } from 'antd';
import { friendlyError } from '../../api/errors';
import { maintenanceCopy as t } from './copy';

export function MaintenanceError({ error, retry, title }: { error: unknown; retry?: () => unknown; title?: string }) {
  const info = friendlyError(error);
  return (
    <Alert
      type="error"
      showIcon
      title={title ?? info.message}
      description={title ? info.message : undefined}
      action={
        info.status === 401 ? (
          <Button onClick={() => window.location.assign('/user/login')}>{t.login}</Button>
        ) : (
          retry && <Button onClick={() => void retry()}>{t.retry}</Button>
        )
      }
    />
  );
}
