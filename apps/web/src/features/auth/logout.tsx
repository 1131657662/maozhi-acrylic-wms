import { Alert, Button } from 'antd';
import { useLogout } from './use-logout';

export function LogoutButton() {
  const { mutate: logout, isPending: isLoggingOut, error: logoutError } = useLogout();
  return (
    <>
      {logoutError && <Alert type="error" title={logoutError.message} />}
      <Button loading={isLoggingOut} onClick={() => logout()}>
        退出登录
      </Button>
    </>
  );
}
