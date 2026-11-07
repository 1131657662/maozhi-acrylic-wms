import type { ReactNode } from 'react';
import { StrictMode } from 'react';
import { App as AntApp, ConfigProvider, Result, Button } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryCache, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import type { RunTimeLayoutConfig } from '@umijs/max';
import { Link } from '@umijs/max';
import { authKeys } from './features/auth/keys';
import { ApiError } from './api/client';
import { LogoutButton } from './features/auth/logout';
import './styles.css';

const client = new QueryClient({
  defaultOptions: { queries: { retry: 1 } },
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof ApiError && error.status === 401) client.setQueryData(authKeys.session.queryKey, null);
    },
  }),
});

export function rootContainer(container: ReactNode) {
  return (
    <StrictMode>
      <ErrorBoundary
        fallbackRender={({ resetErrorBoundary }) => (
          <Result status="error" title="页面加载失败" extra={<Button onClick={resetErrorBoundary}>重试</Button>} />
        )}
      >
        <ConfigProvider
          locale={zhCN}
          theme={{
            token: {
              colorPrimary: '#105957',
              borderRadius: 8,
              fontFamily: 'Inter, Microsoft YaHei, sans-serif',
              colorBgLayout: '#f3f6f5',
            },
          }}
        >
          <AntApp>
            <QueryClientProvider client={client}>{container}</QueryClientProvider>
          </AntApp>
        </ConfigProvider>
      </ErrorBoundary>
    </StrictMode>
  );
}

export const layout: RunTimeLayoutConfig = () => ({
  title: '茂智腈纶仓',
  menuHeaderRender: () => (
    <Link to="/" className="pro-brand">
      <span className="pro-brand-mark">M</span>
      <span>
        <strong>茂智腈纶仓</strong>
        <small>Maozhi Acrylic Fiber WMS</small>
      </span>
    </Link>
  ),
  menuItemRender: (item, dom) => (item.path ? <Link to={item.path}>{dom}</Link> : dom),
  actionsRender: () => [
    <span className="environment-label" key="environment">
      本地验证环境
    </span>,
    <LogoutButton key="logout" />,
  ],
  footerRender: () => <div className="pro-footer">茂智云仓 · 腈纶仓储管理系统 · Maozhi Acrylic Fiber WMS</div>,
});
