import { expect } from '@playwright/test';
import { shipmentListSchema } from '@wms/contracts';
import { test } from './list-test';
import { shipmentOrder, inputShipment } from './shipment-ui-helpers';

test('AF-054 商品列保持宽度与省略提示，窄屏仅表内横向滚动', async ({ page }) => {
  const order = await shipmentOrder(page, true);
  const name = '腈纶纤维长商品名称用于验证表格单行省略与完整提示';
  const extras = '合同号：AF054-长合同编号-20261112 · 行备注：这是一条用于验证第二行省略与完整提示的较长备注';
  await page.route(`**/api/v1/outbound/${order.id}/shipments`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const data = shipmentListSchema.parse(body.data);
    Object.assign(data.lines[0]!, {
      productName: name,
      contractNo: 'AF054-长合同编号-20261112',
      memo: '这是一条用于验证第二行省略与完整提示的较长备注',
    });
    await route.fulfill({ response, json: { ...body, data } });
  });
  await page.goto(`/outbound/${order.id}`);
  await inputShipment(page, 40, '12');
  const table = page.getByTestId('actual-lines');
  const products = table.locator('tbody tr[data-row-key] td:first-child');
  await expect(products.nth(0).locator('.ant-typography')).toHaveCount(2);
  await expect(products.nth(1).locator('.ant-typography')).toHaveCount(1);
  await expect(products.nth(1)).not.toContainText('历史未记录');
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    const scroll = table.locator('.ant-table-content');
    await scroll.evaluate((element) => {
      element.scrollLeft = 0;
    });
    const widths = await table
      .locator('thead th')
      .evaluateAll((cells) => cells.map((cell) => cell.getBoundingClientRect().width));
    expect(widths[0]).toBeGreaterThanOrEqual(200);
    widths.slice(1).forEach((value, index) => expect(value).toBeCloseTo([130, 130, 130, 160, 200][index]!, 0));
    if (width === 1280) {
      expect(widths[0]).toBeCloseTo(200, 0);
      expect(await scroll.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const difference = table.locator('tbody tr[data-row-key]').first().locator('td:last-child');
    const differenceFits = await difference.evaluate((cell) => {
      const text = cell.querySelector('.ant-typography')!.getBoundingClientRect();
      const bounds = cell.getBoundingClientRect();
      return {
        fits: text.left >= bounds.left && text.right <= bounds.right,
        textLeft: text.left,
        textRight: text.right,
        cellLeft: bounds.left,
        cellRight: bounds.right,
        cellWidth: bounds.width,
      };
    });
    console.log('AF054_DIFF_BOUNDS', JSON.stringify({ width, ...differenceFits }));
    expect(differenceFits.fits).toBe(true);
    for (const [index, content] of [name, extras].entries()) {
      const text = products.first().locator('.ant-typography').nth(index);
      await expect(text).toHaveCSS('white-space', 'nowrap');
      await text.hover();
      await expect(page.getByRole('tooltip')).toHaveText(content);
      await page.getByRole('heading').first().hover();
      await expect(page.getByRole('tooltip')).toHaveCount(0);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: `.local/evidence/b5c-3-af054-entry-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    await scroll.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.screenshot({
      path: `.local/evidence/b5c-3-af054-right-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    console.log('AF054_LAYOUT', JSON.stringify({ width, columnWidths: widths, pageOverflow: false }));
  }
});
