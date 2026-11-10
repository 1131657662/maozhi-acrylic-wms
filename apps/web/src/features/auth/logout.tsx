import { RequestError } from '../../components/RequestError';
import { Button } from 'antd';
import { useLogout } from './use-logout';

export function LogoutButton() {
  const { mutate: logout, isPending: isLoggingOut, error: logoutError } = useLogout();
  return (
    <>
      {logoutError && <RequestError type="error" error={logoutError} />}
      <Button loading={isLoggingOut} onClick={() => logout()}>
        退出登录
      </Button>
    </>
  );
}
