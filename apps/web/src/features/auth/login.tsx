import { useSubmitLock } from '../../components/form-protection/use-submit-lock';
import { useState } from 'react';
import { history, useLocation } from '@umijs/max';
import { Alert } from 'antd';
import { ProForm, ProFormText } from '@ant-design/pro-components';
import { useQueryClient } from '@tanstack/react-query';
import { loginResultSchema } from '@wms/contracts';
import { request } from '../../api/client';
import { authKeys } from './keys';
import { LoginShell } from './login-shell';
import { loginCopy as t } from './copy';

interface LoginValues {
  username?: string;
  password?: string;
}

export function Login() {
  const client = useQueryClient();
  const lock = useSubmitLock();
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const redirect = new URLSearchParams(location.search).get('redirect') || '/';

  async function submit(values: LoginValues): Promise<boolean> {
    setError(null);
    try {
      const session = await request('/auth/login', loginResultSchema, {
        method: 'POST',
        body: JSON.stringify({ username: values.username, password: values.password, channel: 'web' }),
      });
      client.setQueryData(authKeys.session.queryKey, session);
      history.replace(redirect);
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.failed);
      return false;
    }
  }

  return (
    <LoginShell>
      <ProForm<LoginValues>
        onFinish={(values) => lock.run(() => submit(values))}
        submitter={{
          searchConfig: { submitText: lock.text(t.submit) },
          resetButtonProps: false,
          submitButtonProps: { ...lock.button, size: 'large', block: true },
        }}
        initialValues={{ username: 'owner' }}
      >
        <div className="login-description">{t.description}</div>
        <ProFormText
          name="username"
          label={t.username}
          placeholder={t.usernameRequired}
          fieldProps={{ autoComplete: 'username', size: 'large' }}
          rules={[{ required: true, message: t.usernameRequired }]}
        />
        <ProFormText.Password
          name="password"
          label={t.password}
          placeholder={t.passwordRequired}
          fieldProps={{ autoComplete: 'current-password', size: 'large' }}
          rules={[{ required: true, message: t.passwordRequired }]}
        />
        {error && <Alert type="error" title={error} showIcon />}
        <div className="login-access-hint">{t.accessHint}</div>
      </ProForm>
    </LoginShell>
  );
}
