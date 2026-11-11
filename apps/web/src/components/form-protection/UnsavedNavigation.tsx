import { useEffect, useSyncExternalStore } from 'react';
import { history } from '@umijs/max';
import { App } from 'antd';
import { unsavedEntries, hasUnsaved, subscribeUnsaved } from './unsaved-registry';
import { formCopy } from './copy';

export function UnsavedNavigation() {
  const { modal } = App.useApp();
  const dirty = useSyncExternalStore(subscribeUnsaved, hasUnsaved, () => false);
  useEffect(() => {
    if (!dirty) return;
    let asking = false,
      disposed = false;
    let stopListening = () => {};
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
        // POP retries complete asynchronously; rearm only after history applied it.
        stopListening = history.listen(() => {
          stopListening();
          queueMicrotask(() => {
            if (!disposed && hasUnsaved()) unblock = arm();
          });
        });
        transition.retry();
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
      stopListening();
      window.removeEventListener('beforeunload', beforeUnload);
    };
  }, [modal, dirty]);
  return null;
}
