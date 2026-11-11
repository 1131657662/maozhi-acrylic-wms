import { useRef } from 'react';
import { App, type ModalFuncProps } from 'antd';
import { useSubmitLock } from './use-submit-lock';
import { formCopy } from './copy';

type Options = Omit<ModalFuncProps, 'onOk'> & { onOk: () => Promise<unknown> };
export function useLockedConfirm() {
  const { modal } = App.useApp();
  const open = useRef(false);
  const lock = useSubmitLock();
  function confirm(options: Options) {
    if (open.current) return;
    open.current = true;
    const dialog = modal.confirm({
      ...options,
      afterClose: () => {
        open.current = false;
        options.afterClose?.();
      },
      onOk: () =>
        lock
          .run(async () => {
            dialog.update({
              okText: formCopy.submitting,
              okButtonProps: { ...options.okButtonProps, disabled: true, loading: true },
              cancelButtonProps: { disabled: true },
              keyboard: false,
              closable: false,
            });
            return options.onOk();
          })
          .finally(() => {
            dialog.update({
              okText: options.okText,
              okButtonProps: { ...options.okButtonProps, disabled: false, loading: false },
              cancelButtonProps: { ...options.cancelButtonProps, disabled: false },
              keyboard: options.keyboard,
            });
          }),
    });
    // Observe the hook modal result so rejected actions stay retryable without
    // Ant Design forwarding the handled mutation error as an unhandled rejection.
    void dialog.then(
      () => undefined,
      () => undefined,
    );
    return dialog;
  }
  return { confirm, busy: lock.busy };
}
