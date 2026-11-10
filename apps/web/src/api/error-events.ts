import { friendlyError, type ApiError } from './errors';

type Listener = (error: ApiError) => void;
const listeners = new Set<Listener>();
export function onRequestError(listener: Listener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
export function reportRequestError(error: ApiError) {
  listeners.forEach((listener) => listener(error));
}
export function notifyError(error: unknown) {
  reportRequestError(friendlyError(error));
}
