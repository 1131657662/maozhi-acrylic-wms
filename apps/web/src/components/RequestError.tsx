import type { ReactNode } from 'react';
import { Alert, Button, Collapse, Space, Typography, type AlertProps } from 'antd';
import { friendlyError } from '../api/errors';
import { errorCopy, errorUi } from '../text';

export function ErrorDetails({ error }: { error: unknown }) {
  const info = friendlyError(error);
  const values = [
    [errorUi.time, info.time],
    [errorUi.path, info.path || '—'],
    [errorUi.status, info.status || errorUi.unavailable],
    [errorUi.trace, info.traceId || '—'],
  ];
  const diagnostic = values.map(([label, value]) => `${label}：${value}`).join('\n');
  return (
    <Collapse
      size="small"
      ghost
      items={[
        {
          key: 'details',
          label: errorUi.details,
          children: (
            <>
              {values.map(([label, value]) => (
                <div key={label}>
                  {label}：{value}
                </div>
              ))}
              <Typography.Text copyable={{ text: diagnostic, tooltips: [errorUi.copy, errorUi.copied] }}>
                {errorUi.copy}
              </Typography.Text>
            </>
          ),
        },
      ]}
    />
  );
}
export function RequestError({
  error,
  retry,
  action,
  title,
  description,
  ...props
}: Omit<AlertProps, 'title'> & {
  error: unknown;
  retry?: () => unknown;
  title?: ReactNode;
}) {
  const info = friendlyError(error);
  const act = () => {
    if (info.kind === 'UNAUTHORIZED') window.location.assign('/user/login');
    else if (info.kind === 'NOT_FOUND') window.history.back();
    else retry?.();
  };
  return (
    <Alert
      {...props}
      type="error"
      showIcon
      title={title ?? info.message}
      description={
        <>
          {title && <p>{info.message}</p>}
          {description}
          <ErrorDetails error={info} />
        </>
      }
      action={
        action ?? (
          <Space>
            {info.kind !== 'FORBIDDEN' && (retry || ['UNAUTHORIZED', 'NOT_FOUND'].includes(info.kind)) && (
              <Button aria-label={errorCopy[info.kind][1]} onClick={act}>
                {errorCopy[info.kind][1]}
              </Button>
            )}
          </Space>
        )
      }
    />
  );
}
