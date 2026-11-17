import { expect } from '@playwright/test';
import bcrypt from 'bcryptjs';
import { AUTH_TEXT } from '@wms/contracts';
import { e2eDatabase, screenshotWidths } from './inventory-helpers';
import {
  test,
  loginIdentity,
  fillPasswords,
  mobileSession,
  identityPassword,
  identityNextPassword,
} from './identity-fixture';

test('B8b个人资料、三端会话、撤销和双宽截图', async ({ page, identityUser }) => {
  for (const channel of ['pda', 'miniapp'] as const) await mobileSession(page, identityUser, channel);
  await loginIdentity(page, identityUser);
  await page.getByLabel('显示名', { exact: true }).fill('仓库管理员');
  await page.getByRole('button', { name: '保存资料' }).click();
  await expect(page.getByRole('link', { name: '仓库管理员', exact: true })).toBeVisible();
  await expect(page.getByTestId('identity-sessions').getByRole('row').filter({ hasText: '当前会话' })).toHaveCount(1);
  await expect(page.getByTestId('identity-sessions').getByRole('row').filter({ hasText: '手持终端' })).toHaveCount(1);
  await expect(page.getByRole('button', { name: '保存资料' })).toBeEnabled();
  await expect(page.getByText('个人资料已保存', { exact: true })).toBeHidden();
  await screenshotWidths(page, 'b8b/personal-center');
  const row = page.getByTestId('identity-sessions').getByRole('row').filter({ hasText: '手持终端' });
  await row.getByRole('button', { name: /撤\s*销/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /取\s*消/ })
    .click();
  await expect(row).toHaveCount(1);
  await row.getByRole('button', { name: /撤\s*销/ }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /撤\s*销/ })
    .click();
  await expect(row).toHaveCount(0);
  await page
    .getByTestId('identity-sessions')
    .getByRole('row')
    .filter({ hasText: '当前会话' })
    .getByRole('button', { name: /撤\s*销/ })
    .click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /撤\s*销/ })
    .click();
  await expect(page).toHaveURL(/\/user\/login/);
});

test('B8b改密清空表单、不落草稿、三端旧会话失效并回登录', async ({ page, identityUser }) => {
  const tokens: string[] = [];
  for (const channel of ['pda', 'miniapp'] as const) tokens.push(await mobileSession(page, identityUser, channel));
  await loginIdentity(page, identityUser);
  const oldWebCookie = (await page.context().cookies()).find((cookie) => cookie.name === 'wms_session')!;
  await fillPasswords(page, identityPassword, 'Aa1' + '中'.repeat(24));
  await page.getByRole('button', { name: '修改密码', exact: true }).click();
  await expect(page.getByText(AUTH_TEXT.passwordTooLong, { exact: true })).toBeVisible();
  await fillPasswords(page, 'wrong-password', identityNextPassword);
  await page.getByRole('button', { name: '修改密码', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认修改' }).click();
  await expect(page.getByLabel('原密码', { exact: true })).toHaveValue('');
  await expect(page.getByText(AUTH_TEXT.oldPassword, { exact: true }).first()).toBeVisible();
  await fillPasswords(page);
  const storage = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  expect(storage).not.toContain(identityPassword);
  expect(storage).not.toContain(identityNextPassword);
  await page.getByRole('button', { name: '修改密码', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认修改' }).click();
  await expect(page).toHaveURL(/password=changed/);
  for (const token of [...tokens, oldWebCookie.value]) {
    expect(
      (await page.request.get('/api/v1/auth/me', { headers: { Authorization: `Bearer ${token}` } })).status(),
    ).toBe(401);
  }
  await loginIdentity(page, identityUser, identityNextPassword);
  await expect(page.getByTestId('identity-sessions').getByRole('row').filter({ hasText: '当前会话' })).toHaveCount(1);
  await page.getByRole('button', { name: '退出登录', exact: true }).last().click();
  await page.getByRole('dialog').getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page).toHaveURL(/\/user\/login/);
});

test('B8b旧超长密码提示改密，锁定登录显示剩余秒数', async ({ page, identityUser }) => {
  const legacy = 'Legacy-password-123' + 'x'.repeat(60);
  const db = e2eDatabase();
  try {
    await db.run('UPDATE owner SET password_hash=? WHERE username=?', [await bcrypt.hash(legacy, 4), identityUser]);
    await loginIdentity(page, identityUser, legacy);
    await expect(page.getByText(AUTH_TEXT.legacyPassword, { exact: true })).toBeVisible();
    await db.run(
      'UPDATE owner SET failed_attempts=5,locked_until=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 15 MINUTE) WHERE username=?',
      [identityUser],
    );
    await page.goto('/user/login');
    await page.getByLabel('用户名', { exact: true }).fill(identityUser);
    await page.getByLabel('密码', { exact: true }).fill(legacy);
    await page.getByRole('button', { name: /登\s*录/ }).click();
    await expect(page.getByText(/账号暂时锁定.*\d+ 秒后重试/).first()).toBeVisible();
  } finally {
    await db.close();
  }
});
