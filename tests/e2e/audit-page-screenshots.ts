import { expect, type Page } from '@playwright/test';

export async function auditPageScreenshots(page: Page, name: string) {
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    // Finish the drawer/collapse transitions before choosing the evidence viewport.
    await page.screenshot({ animations: 'disabled' });
    if (name === 'raw')
      await page
        .getByRole('dialog')
        .locator('.ant-drawer-body')
        .evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
    if (name === 'failed')
      await page
        .getByTestId('audit-list')
        .locator('.ant-table-body')
        .evaluate((element) => {
          element.scrollLeft = element.scrollWidth;
        });
    await page.evaluate(() => window.scrollTo(0, 0));
    const dimensions = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(dimensions.scrollWidth).toBe(dimensions.clientWidth);
    await page.screenshot({
      path: `.local/evidence/b6c-3-${name}-${width}.png`,
      fullPage: true,
      animations: 'disabled',
    });
    console.log('B6C3_VIEWPORT', JSON.stringify({ name, width, ...dimensions }));
  }
}
