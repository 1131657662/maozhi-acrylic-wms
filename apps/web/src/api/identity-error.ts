import { AUTH_POLICY, AUTH_TEXT } from '@wms/contracts';
import { z } from 'zod';

const retrySchema = z.object({
  retryAfterSeconds: z
    .number()
    .int()
    .positive()
    .max(AUTH_POLICY.lockMs / 1000),
});
export function identityError(message: string, status: number, path: string, data: unknown): string | undefined {
  if (path === '/auth/login' && status === 401 && message === AUTH_TEXT.invalidCredentials) return message;
  if (path === '/auth/login' && status === 429 && message === AUTH_TEXT.locked) {
    const parsed = retrySchema.safeParse(data);
    return parsed.success ? `${AUTH_TEXT.locked}，请在 ${parsed.data.retryAfterSeconds} 秒后重试` : AUTH_TEXT.locked;
  }
  if (
    path === '/me/password' &&
    status === 422 &&
    [AUTH_TEXT.oldPassword, AUTH_TEXT.passwordRule, AUTH_TEXT.passwordTooLong].some((text) => text === message)
  )
    return message;
  return undefined;
}
