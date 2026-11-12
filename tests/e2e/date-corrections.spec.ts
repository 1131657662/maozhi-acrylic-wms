import { expect } from '@playwright/test';
import { shanghaiToday, backdateThreshold } from '@wms/contracts';
import { test } from './list-test';
import { post, screenshotWidths } from './inventory-helpers';
import { dateDocument, openDateCorrection, fillDateCorrection } from './date-correction-helpers';

const shifted = (value: string, days: number) =>
  new Date(Date.parse(value) + days * 86400000).toISOString().slice(0, 10);
for (const kind of ['inbound', 'outbound'] as const)
  test(`B5d-1 ${kind} 日期更正抽屉、超期确认、历史与列表有效日期`, async ({ page }) => {
    test.setTimeout(60000);
    const target = await dateDocument(page, kind),
      old = shifted(backdateThreshold(shanghaiToday()), -1);
    await page.goto(target.path);
    await openDateCorrection(page);
    await fillDateCorrection(page, old, '核对原始送货凭据');
    const confirmation = page.getByRole('dialog', { name: '确认回填超过 3 个月的业务日期？' });
    await expect(confirmation).toBeVisible();
    await confirmation.getByRole('button', { name: '返回核对', exact: true }).click();
    await expect(page.getByLabel('新日期', { exact: true })).toHaveValue(old);
    await expect(page.getByRole('dialog').getByRole('button', { name: /^提\s*交$/ })).toBeEnabled();
    await screenshotWidths(page, `b5d-1-${kind}-drawer`);
    await page
      .getByRole('dialog')
      .getByRole('button', { name: /^提\s*交$/ })
      .click();
    const saved = page.waitForResponse(
      (r) => r.url().endsWith(`${target.path}/date-corrections`) && r.request().method() === 'POST',
    );
    await confirmation.getByRole('button', { name: '确认更正', exact: true }).click();
    expect((await saved).status()).toBe(200);
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(old, { exact: true })).toBeVisible();
    await page.getByText('原始业务日期与更正记录', { exact: true }).click();
    await expect(page.getByTestId('date-correction-panel')).toContainText(`${shanghaiToday()} → ${old}`);
    await expect(page.getByTestId('date-correction-panel')).toContainText('核对原始送货凭据');
    await screenshotWidths(page, `b5d-1-${kind}-history`);
    const detail = (await (await page.request.get(`/api/v1${target.path}`)).json()).data;
    expect(detail.businessDate).toBe(shanghaiToday());
    expect(detail.effectiveBusinessDate).toBe(old);
    await page.goto(kind === 'inbound' ? '/inbound' : '/');
    await page.getByRole('searchbox', { name: kind === 'inbound' ? '搜索入库单' : '搜索出库单' }).fill(target.number);
    await page.getByRole('button', { name: /查\s*询/, exact: true }).click();
    await expect(
      page.getByRole('row').filter({ hasText: target.number }).getByText(old, { exact: true }),
    ).toBeVisible();
  });

test('B5d-1 响应丢失后原键原正文重试，日期历史仅一条', async ({ page }) => {
  const target = await dateDocument(page, 'inbound'),
    afterDate = shifted(shanghaiToday(), -1);
  const requests: { key: string | undefined; body: string | null }[] = [];
  let lost = false;
  await page.route(`**/api/v1${target.path}/date-corrections`, async (route) => {
    if (route.request().method() !== 'POST') return route.continue();
    requests.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
    if (lost) return route.continue();
    lost = true;
    expect((await route.fetch()).status()).toBe(200);
    await route.abort('failed');
  });
  await page.goto(target.path);
  await openDateCorrection(page);
  await fillDateCorrection(page, afterDate, '重试保留原请求');
  const confirm = page.getByRole('dialog', { name: '确认更正业务日期？' });
  await confirm.getByRole('button', { name: '确认更正', exact: true }).click();
  await expect(page.getByText('填写内容已保留。网络失败可重试；版本变化时请重新打开抽屉核对。')).toBeVisible();
  await confirm.getByRole('button', { name: '确认更正', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(requests).toHaveLength(2);
  expect(requests[1]).toEqual(requests[0]);
  const history = (await (await page.request.get(`/api/v1${target.path}/date-corrections`)).json()).data;
  expect(history.records).toHaveLength(1);
});

test('B5d-1 打开后的日期版本变化返回409且保留录入', async ({ page }) => {
  const target = await dateDocument(page, 'outbound'),
    changed = shifted(shanghaiToday(), -1);
  await page.goto(target.path);
  await openDateCorrection(page);
  expect(
    (
      await post(page, `${target.path}/date-corrections`, {
        afterDate: changed,
        reason: '另一请求先完成',
        expectedRevision: 0,
      })
    ).status(),
  ).toBe(200);
  const input = shifted(shanghaiToday(), -2);
  await fillDateCorrection(page, input, '保留待核对输入');
  const saved = page.waitForResponse((r) => r.url().endsWith('/date-corrections') && r.request().method() === 'POST');
  await page
    .getByRole('dialog', { name: '确认更正业务日期？' })
    .getByRole('button', { name: '确认更正', exact: true })
    .click();
  expect((await saved).status()).toBe(409);
  await page.getByRole('button', { name: '返回核对', exact: true }).click();
  await expect(page.getByLabel('新日期', { exact: true })).toHaveValue(input);
  await expect(page.getByLabel('更正原因', { exact: true })).toHaveValue('保留待核对输入');
});
