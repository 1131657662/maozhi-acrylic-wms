import { randomUUID } from 'node:crypto';
import { expect } from '@playwright/test';
import { test } from './list-test';
import { searchOptions, searchPopup, masterPage } from './master-search-helpers';

test('B6g-2 车辆 q 联想只含启用项，键盘选择回填车牌并允许新车牌', async ({ page }) => {
  const marker = randomUUID().slice(0, 8).toUpperCase();
  const plates = [`浙 B ${marker}1`, `浙 B ${marker}2`];
  for (const [index, plate] of plates.entries()) {
    const response = await page.request.post('/api/v1/master/vehicles', {
      headers: { Origin: 'http://127.0.0.1:5174' },
      data: { plate },
    });
    expect(response.ok()).toBe(true);
    if (index === 1) {
      const row = (await response.json()).data;
      const disabled = await page.request.patch(`/api/v1/master/vehicles/${row.id}`, {
        headers: { Origin: 'http://127.0.0.1:5174' },
        data: { active: false },
      });
      expect(disabled.ok()).toBe(true);
    }
  }
  await page.goto('/outbound/new');
  const input = page.getByLabel('车牌', { exact: true });
  const response = page.waitForResponse((r) => new URL(r.url()).searchParams.get('q') === marker.toLowerCase());
  await input.fill(marker.toLowerCase());
  expect(new URL((await response).url()).searchParams.get('status')).toBe('active');
  await expect(searchOptions(page)).toHaveCount(1);
  await expect(searchOptions(page)).toContainText(plates[0]!);
  await input.press('ArrowDown');
  await input.press('Enter');
  await expect(input).toHaveValue(plates[0]!);
  await input.click();
  await input.press('Escape');
  await expect(searchPopup(page)).toHaveCount(0);
  await expect(input).toHaveValue(plates[0]!);
  await input.fill(`新车-${marker}`);
  await expect(searchPopup(page)).toContainText('没有匹配的车辆，换个关键词试试');
  await expect(input).toHaveValue(`新车-${marker}`);
  await page.screenshot({ path: '.local/evidence/b6g-2/vehicle-empty-1440.png', fullPage: true });
});

test('B6g-2 车辆防抖后用 q 查询，加载显示 Spin，零结果与等待状态分离', async ({ page }) => {
  const requests: string[] = [];
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/master/vehicles?**', async (route) => {
    requests.push(new URL(route.request().url()).searchParams.get('q')!);
    await blocked;
    await masterPage(route, []);
  });
  await page.goto('/outbound/new');
  const input = page.getByLabel('车牌', { exact: true });
  await page.clock.install();
  await input.fill('8');
  await page.clock.runFor(100);
  await input.fill('80807');
  await page.clock.runFor(299);
  expect(requests).toEqual([]);
  await page.clock.runFor(1);
  await expect.poll(() => requests).toEqual(['80807']);
  await expect(searchPopup(page).getByRole('status', { name: '正在搜索' })).toBeVisible();
  await expect(searchPopup(page)).not.toContainText('没有匹配的车辆');
  release();
  await page.clock.runFor(100);
  await expect(searchPopup(page)).toContainText('没有匹配的车辆，换个关键词试试');
  await expect(searchPopup(page).getByRole('status', { name: '正在搜索' })).toHaveCount(0);
});

for (const [label, catalog] of [
  ['客户', 'customers'],
  ['供应商', 'suppliers'],
] as const) {
  test(`B6g-2 ${label}沿用 q 搜索与对应零结果文案`, async ({ page }) => {
    await page.goto(catalog === 'customers' ? '/outbound/new' : '/inbound/new');
    const response = page.waitForResponse(
      (r) => r.url().includes(`/master/${catalog}?`) && new URL(r.url()).searchParams.get('q') === '不存在-联想验收',
    );
    await page.getByLabel(label, { exact: true }).fill('不存在-联想验收');
    expect((await response).ok()).toBe(true);
    await expect(searchPopup(page)).toContainText(`没有匹配的${label}，换个关键词试试`);
  });
}
