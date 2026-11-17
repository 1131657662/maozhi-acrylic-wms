import { test as base, expect, type Page } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { e2eDatabase } from './inventory-helpers';
import { loginResultSchema } from '@wms/contracts';

export const identityPassword = 'Identity-test-password-123';
export const identityNextPassword = 'Identity-next-password-456';
export async function mobileSession(page: Page, username: string, channel: 'pda' | 'miniapp') {
  const response = await page.request.post('http://127.0.0.1:4311/api/v1/auth/login', {
    data: { username, password: identityPassword, channel },
  });
  expect(response.status()).toBe(200);
  const result = loginResultSchema.parse((await response.json()).data);
  expect(result.channel).toBe(channel);
  expect(result.token).toBeTruthy();
  return result.token!;
}
export const test = base.extend<{ identityUser: string }>({
  identityUser: async ({}, use) => {
    const db = e2eDatabase();
    const username = `b8b-${randomUUID().slice(0, 8)}`;
    try {
      await db.run('INSERT INTO owner(username,password_hash) VALUES(?,?)', [
        username,
        await bcrypt.hash(identityPassword, 4),
      ]);
      await use(username);
    } finally {
      await db.close();
    }
  },
});

export async function loginIdentity(page: Page, username: string, password = identityPassword) {
  await page.goto('/user/login?redirect=/me');
  await page.getByLabel('用户名', { exact: true }).fill(username);
  await page.getByLabel('密码', { exact: true }).fill(password);
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page.getByRole('heading', { name: '个人中心' })).toBeVisible();
}

export async function fillPasswords(page: Page, oldPassword = identityPassword, newPassword = identityNextPassword) {
  await page.getByLabel('原密码', { exact: true }).fill(oldPassword);
  await page.getByLabel('新密码', { exact: true }).fill(newPassword);
  await page.getByLabel('确认新密码', { exact: true }).fill(newPassword);
}
