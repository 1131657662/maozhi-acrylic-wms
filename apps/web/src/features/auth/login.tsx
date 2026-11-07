import { useState } from 'react';
import { history, useLocation } from '@umijs/max';
import { Alert, Typography } from 'antd';
import { ProForm, ProFormText } from '@ant-design/pro-components';
import { useQueryClient } from '@tanstack/react-query';
import { loginResultSchema } from '@wms/contracts';
import { request } from '../../api/client';
import { authKeys } from './keys';

interface LoginValues {
  username?: string;
  password?: string;
}

export function Login() {
  const client = useQueryClient();
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
      setError(cause instanceof Error ? cause.message : '登录失败，请重试');
      return false;
    }
  }

  return (
    <main className="login-page">
      <section className="login-intro">
        <span className="eyebrow">Maozhi Acrylic Fiber WMS</span>
        <h1>
          每一包有据可查。
          <br />
          每一次出库明确确认。
        </h1>
        <p>茂智云仓 · 腈纶仓储管理系统</p>
        <span className="demo-label">本地合成数据环境</span>
      </section>
      <ProForm<LoginValues>
        className="login-card"
        onFinish={submit}
        submitter={{
          searchConfig: { submitText: '登录' },
          resetButtonProps: false,
          submitButtonProps: { size: 'large', block: true },
        }}
        initialValues={{ username: 'owner' }}
      >
        <Typography.Title level={2}>登录工作台</Typography.Title>
        <p>使用本机初始化时生成的账户</p>
        <ProFormText
          name="username"
          label="用户名"
          placeholder="请输入用户名"
          fieldProps={{ autoComplete: 'username', size: 'large' }}
          rules={[{ required: true, message: '请输入用户名' }]}
        />
        <ProFormText.Password
          name="password"
          label="密码"
          placeholder="请输入密码"
          fieldProps={{ autoComplete: 'current-password', size: 'large' }}
          rules={[{ required: true, message: '请输入密码' }]}
        />
        {error && <Alert type="error" title={error} showIcon />}
        <small>登录信息见项目 .local/demo-access.txt</small>
      </ProForm>
    </main>
  );
}
