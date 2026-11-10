import { useEffect, useRef } from 'react';
import { App, type FormInstance } from 'antd';
import { useSession } from '../../features/auth/use-session';
import { draftKey, serializeValues, parseValues, readDraft } from './draft-storage';
import { registerUnsaved } from './unsaved-registry';
import { DRAFT_DELAY_MS, formCopy } from './copy';

export function useFormDraft(form: FormInstance, kind: string, id = 'new') {
  const { data: session } = useSession();
  const { modal, message } = App.useApp();
  const key = draftKey(session?.username ?? '', kind, id);
  const state = useRef({ initial: '', values: '', dirty: false, ready: false, timer: 0 });
  const asking = useRef(false);
  const flush = () => {
    clearTimeout(state.current.timer);
    if (!state.current.ready || !session?.username) return;
    try {
      if (state.current.dirty)
        localStorage.setItem(
          key,
          JSON.stringify({ values: state.current.values, time: new Date().toLocaleString('zh-CN') }),
        );
      else localStorage.removeItem(key);
    } catch {
      void message.warning(formCopy.unavailable);
    }
  };
  const change = () => {
    if (!state.current.ready) return;
    state.current.values = serializeValues(form.getFieldsValue(true));
    state.current.dirty = state.current.values !== state.current.initial;
    clearTimeout(state.current.timer);
    state.current.timer = window.setTimeout(flush, DRAFT_DELAY_MS);
  };
  useEffect(() => {
    if (!session?.username) return;
    let disposed = false;
    let prompt: ReturnType<typeof modal.confirm> | undefined;
    const unregister = registerUnsaved({ dirty: () => state.current.dirty, flush });
    const boot = window.setTimeout(async () => {
      state.current.initial = serializeValues(form.getFieldsValue(true));
      state.current.values = state.current.initial;
      state.current.ready = true;
      const saved = readDraft(key);
      if (!saved) return;
      prompt = modal.confirm({
        title: `${formCopy.found}（${saved.time}）`,
        content: formCopy.local,
        okText: formCopy.restore,
        cancelText: formCopy.discard,
        mask: { closable: false },
        keyboard: false,
      });
      const restore = await prompt;
      if (disposed) return;
      if (restore) {
        form.setFieldsValue(parseValues(saved.values));
        change();
      } else {
        try {
          localStorage.removeItem(key);
        } catch {
          void message.warning(formCopy.unavailable);
        }
      }
    }, 0);
    return () => {
      disposed = true;
      clearTimeout(boot);
      prompt?.destroy();
      flush();
      unregister();
      state.current.ready = false;
    };
  }, [key, form, modal, session?.username]);
  const saved = () => {
    state.current.initial = state.current.values;
    state.current.dirty = false;
    flush();
  };
  const leave = async (action: () => void) => {
    if (asking.current) return;
    asking.current = true;
    try {
      if (
        !state.current.dirty ||
        (await modal.confirm({
          title: formCopy.unsaved,
          content: formCopy.leave,
          okText: formCopy.abandon,
          cancelText: formCopy.keep,
          autoFocusButton: 'cancel',
        }))
      ) {
        flush();
        action();
      }
    } finally {
      asking.current = false;
    }
  };
  return { change, saved, leave };
}
