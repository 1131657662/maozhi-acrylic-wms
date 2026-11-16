import { webOutboundQuerySchema } from '@wms/contracts';

const listKeys = new Set(Object.keys(webOutboundQuerySchema.shape));
const localOrigin = 'http://wms.invalid';
export function internalDestination(value: string | null | undefined): string {
  if (!value?.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return '/';
  const url = new URL(value, localOrigin);
  if (url.origin !== localOrigin || url.pathname === '/user/login') return '/';
  const path =
    url.pathname === '/' && [...url.searchParams.keys()].some((key) => listKeys.has(key)) ? '/outbound' : url.pathname;
  return path + url.search + url.hash;
}
export function listDestination(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const path = fallback === '/outbound' && value === '/' ? fallback : internalDestination(value);
  const url = new URL(path, localOrigin);
  return url.pathname === fallback ? path : fallback;
}
