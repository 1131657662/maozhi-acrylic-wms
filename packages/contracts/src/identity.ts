import { z } from 'zod';

export const AUTH_POLICY = {
  passwordMinBytes: 12,
  passwordMaxBytes: 72,
  legacyPasswordMaxLength: 128,
  displayNameMaxLength: 80,
  failureLimit: 5,
  lockMs: 15 * 60_000,
  httpWindowMs: 15 * 60_000,
  httpLimit: 20,
  sessionMs: 8 * 3_600_000,
  tokenBytes: 32,
  bcryptRounds: 12,
  sessionPageSize: 10,
} as const;

export const AUTH_TEXT = {
  invalidCredentials: '用户名或密码错误',
  unauthorized: '登录已过期，请重新登录；本机扫码记录会保留',
  locked: '账号暂时锁定，请稍后重试',
  oldPassword: '原密码不正确，请重新输入',
  passwordRule: '新密码需为 12–72 字节，并包含英文字母和数字',
  passwordTooLong: '新密码不能超过 72 字节，中文等字符会占用多个字节',
  legacyPassword: '当前密码超过安全长度，请到网页个人中心修改密码',
  missingSession: '该登录会话不存在或已撤销',
  rateLimited: '登录尝试过多，请稍后重试',
} as const;

export function passwordRuleError(password: string): string | null {
  const bytes = new TextEncoder().encode(password).length;
  if (bytes > AUTH_POLICY.passwordMaxBytes) return AUTH_TEXT.passwordTooLong;
  return bytes < AUTH_POLICY.passwordMinBytes || !/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)
    ? AUTH_TEXT.passwordRule
    : null;
}

export const profileInputSchema = z.strictObject({
  displayName: z.string().trim().max(AUTH_POLICY.displayNameMaxLength),
});
// Business password rules are validated by the service, with explicit safe messages.
export const passwordInputSchema = z.strictObject({
  oldPassword: z.string().min(1).max(AUTH_POLICY.legacyPasswordMaxLength),
  newPassword: z.string(),
});
export const profileSchema = z.object({
  username: z.string(),
  displayName: z.string().nullable(),
  channel: z.enum(['web', 'pda', 'miniapp']),
  lastLoginAt: z.iso.datetime().nullable(),
  expiresAt: z.iso.datetime(),
  passwordChangedAt: z.iso.datetime().nullable(),
});
export const accountSessionSchema = z.object({
  id: z.uuid(),
  channel: z.enum(['web', 'pda', 'miniapp']),
  createdAt: z.iso.datetime(),
  expiresAt: z.iso.datetime(),
  isCurrent: z.boolean(),
});
export const accountSessionsSchema = z.array(accountSessionSchema);
export const revokeSessionResultSchema = z.object({ current: z.boolean() });
export type Profile = z.infer<typeof profileSchema>;
export type AccountSession = z.infer<typeof accountSessionSchema>;
export type PasswordInput = z.infer<typeof passwordInputSchema>;
