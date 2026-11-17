import type { ReactNode } from 'react';
import { StrictMode } from 'react';
import { App as AntApp, ConfigProvider, Result, Button } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryCache, MutationCache, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import type { RunTimeLayoutConfig } from '@umijs/max';
import { Link } from '@umijs/max';
import { authKeys } from './features/auth/keys';
import { ApiError } from './api/client';
import { AccountActions } from './features/identity/account-actions';
import './styles.css';
import { ActiveStocktakeLink } from './features/stocktake/active-link';
import { ErrorNotifications } from './components/ErrorNotifications';
import { ERROR_MAX_VISIBLE } from './text';
import { UnsavedNavigation } from './components/form-protection/UnsavedNavigation';
import { RepeatKeyGuard } from './components/form-protection/RepeatKeyGuard';
import { workbenchKeys } from './features/workbench/keys';
import { analysisKeys } from './features/analysis/queries';
import { MessageMenuLabel } from './features/messages/menu-label';

const client = new QueryClient({
  mutationCache: new MutationCache({
    onSettled: (_data, _error, _variables, _result, mutation) => {
      if (mutation.options.meta?.skipWorkbenchRefresh) return;
      void client.invalidateQueries({ queryKey: workbenchKeys._def });
      void client.invalidateQueries({ queryKey: analysisKeys._def });
    },
  }),
  defaultOptions: { queries: { retry: 1 }, mutations: { networkMode: 'always', retry: false } },
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
          <AntApp notification={{ maxCount: ERROR_MAX_VISIBLE }} message={{ maxCount: ERROR_MAX_VISIBLE }}>
            <ErrorNotifications />
            <QueryClientProvider client={client}>
              <UnsavedNavigation />
              <RepeatKeyGuard />
              {container}
            </QueryClientProvider>
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
  menuItemRender: (item, dom) =>
    item.path ? (
      <Link to={item.path}>{item.path === '/messages' ? <MessageMenuLabel>{dom}</MessageMenuLabel> : dom}</Link>
    ) : (
      dom
    ),
  menuExtraRender: () => <ActiveStocktakeLink />,
  actionsRender: () => [<AccountActions key="account" />],
  footerRender: () => <div className="pro-footer">茂智云仓 · 腈纶仓储管理系统 · Maozhi Acrylic Fiber WMS</div>,
});
