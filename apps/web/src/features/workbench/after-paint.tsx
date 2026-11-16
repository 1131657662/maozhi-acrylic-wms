import { useEffect, useState, type ReactNode } from 'react';

// Synchronize with the browser paint cycle so even a cached chart cannot delay the numbers' first paint.
export function AfterPaint({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let next = 0;
    const first = requestAnimationFrame(() => {
      next = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(next);
    };
  }, []);
  return ready ? children : null;
}
