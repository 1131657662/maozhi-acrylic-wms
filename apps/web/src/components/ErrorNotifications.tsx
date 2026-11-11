import { useEffect } from 'react';
import { App, Button } from 'antd';
import { onRequestError } from '../api/error-events';
import { ERROR_DEDUPE_MS, ERROR_HISTORY_LIMIT, ERROR_SUPPORT_THRESHOLD, errorCopy, errorUi } from '../text';
import { ErrorDetails } from './RequestError';

export function ErrorNotifications() {
  const { notification } = App.useApp();
  useEffect(() => {
    const recent = new Map<string, { time: number; failures: number }>();
    return onRequestError((error) => {
      const key = `${error.kind}:${error.path}:${error.message}`;
      const previous = recent.get(key);
      const failures = (previous?.failures ?? 0) + 1;
      const now = Date.now();
      if (previous && now - previous.time < ERROR_DEDUPE_MS) {
        previous.failures = failures;
        return;
      }
      if (recent.size > ERROR_HISTORY_LIMIT) recent.clear();
      recent.set(key, { time: now, failures });
      notification.error({
        key,
        title: error.message,
        duration: ERROR_DEDUPE_MS / 1000,
        description: (
          <>
            <p>{errorUi.notSaved}</p>
            {failures >= ERROR_SUPPORT_THRESHOLD && <p>{errorUi.repeated}</p>}
            <ErrorDetails error={error} />
          </>
        ),
        actions:
          error.kind === 'UNAUTHORIZED' ? (
            <Button onClick={() => window.location.assign('/user/login')}>{errorCopy.UNAUTHORIZED[1]}</Button>
          ) : undefined,
      });
    });
  }, [notification]);
  return null;
}
