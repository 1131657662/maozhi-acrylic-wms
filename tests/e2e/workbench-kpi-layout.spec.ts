import { expect } from '@playwright/test';
import { test } from './list-test';

for (const [width, height] of [
  [1280, 800],
  [1440, 960],
] as const) {
  test(`工作台 ${width}：侧栏恢复原宽，四指标铺满且长吨数完整同行`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.route('**/api/v1/web/dashboard', async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      body.data.today.data.inbound.grams.value = 2_143_314_200;
      await route.fulfill({ response, json: body });
    });
    await Promise.all([
      page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/auth/me' && response.ok()),
      page.goto('/'),
    ]);
    const side = page.locator('aside.ant-layout-sider');
    const toggle = side.locator('[class*="sider-collapsed-button"]');
    await expect(side).toHaveCSS('width', '208px');
    await toggle.click();
    await expect(side).toHaveCSS('width', '64px');
    await toggle.click();
    await expect(side).toHaveCSS('width', '208px');
    const content = page.getByTestId('workbench-content');
    const inbound = page.getByTestId('workbench-inbound');
    const value = inbound.getByText('2143.3142', { exact: true });
    const unit = inbound.getByText('吨', { exact: true });
    await expect(value).toHaveCSS('font-size', '28px');
    await expect(value).toHaveCSS('line-height', '36px');
    await expect(value).toHaveCSS('font-weight', '600');
    await expect(unit).toHaveCSS('font-size', '12px');
    await expect(unit).toHaveCSS('line-height', '20px');
    await expect(unit).toHaveCSS('font-weight', '400');
    const numberBox = (await value.boundingBox())!;
    const unitBox = (await unit.boundingBox())!;
    const card = (await inbound.boundingBox())!;
    expect(numberBox.x).toBeGreaterThanOrEqual(card.x);
    expect(unitBox.x - numberBox.x - numberBox.width).toBeCloseTo(4, 0);
    expect(unitBox.x + unitBox.width).toBeLessThanOrEqual(card.x + card.width);
    expect(unitBox.y).toBeGreaterThanOrEqual(numberBox.y);
    expect(unitBox.y + unitBox.height).toBeLessThanOrEqual(numberBox.y + numberBox.height);
    const cards = await content
      .locator('.wms-workbench-kpis .ant-card')
      .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON()));
    const bounds = (await content.boundingBox())!;
    expect(cards).toHaveLength(4);
    for (const box of cards) {
      expect(box.y).toBe(cards[0].y);
      expect(Math.abs(box.height - cards[0].height)).toBeLessThanOrEqual(2);
      expect(Math.abs(box.width - cards[0].width)).toBeLessThanOrEqual(1);
    }
    expect(cards[0].x).toBeCloseTo(bounds.x, 0);
    expect(cards[3].right).toBeCloseTo(bounds.x + bounds.width, 0);
    const todos = page.getByTestId('workbench-todos');
    for (const name of ['进行中盘点', '已扫码超时'])
      await expect(todos.getByRole('link', { name, exact: true })).toBeInViewport({ ratio: 1 });
  });
}
