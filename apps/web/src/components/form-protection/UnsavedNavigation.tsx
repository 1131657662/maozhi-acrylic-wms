import { useEffect } from 'react';
import { history } from '@umijs/max';
import { App } from 'antd';
import { unsavedEntries } from './unsaved-registry';
import { formCopy } from './copy';

export function UnsavedNavigation() {
  const { modal } = App.useApp();
  useEffect(() => {
    let asking = false,
      disposed = false;
    const arm = () =>
      history.block(async (transition) => {
        if (asking) return;
        const dirty = unsavedEntries();
        if (dirty.length) {
          asking = true;
          const ok = await modal.confirm({
            title: formCopy.unsaved,
            content: formCopy.leave,
            okText: formCopy.abandon,
            cancelText: formCopy.keep,
            autoFocusButton: 'cancel',
          });
          asking = false;
          if (!ok || disposed) return;
          dirty.forEach((entry) => entry.flush());
        }
        unblock();
        transition.retry();
        queueMicrotask(() => {
          if (!disposed) unblock = arm();
        });
      });
    let unblock = arm();
    const beforeUnload = (event: BeforeUnloadEvent) => {
      const dirty = unsavedEntries();
      if (!dirty.length) return;
      dirty.forEach((entry) => entry.flush());
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      disposed = true;
      unblock();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [modal]);
  return null;
}
