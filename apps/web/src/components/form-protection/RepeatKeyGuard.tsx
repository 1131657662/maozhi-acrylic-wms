import { useEffect } from 'react';

export function RepeatKeyGuard() {
  useEffect(() => {
    const ignoreRepeat = (event: KeyboardEvent) => {
      if (event.key !== 'Enter' || !event.repeat) return;
      if (!(event.target instanceof Element) || event.target.closest('textarea,[contenteditable="true"]')) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    document.addEventListener('keydown', ignoreRepeat, true);
    return () => document.removeEventListener('keydown', ignoreRepeat, true);
  }, []);
  return null;
}
