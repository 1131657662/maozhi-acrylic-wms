import { randomUUID } from 'node:crypto';
import { expect, type Page, type Route } from '@playwright/test';
import { masterItemSchema, type MasterItem } from '@wms/contracts';

export const searchOptions = (page: Page) => page.locator('.ant-select-dropdown:visible .ant-select-item-option');
export const searchPopup = (page: Page) => page.locator('.ant-select-dropdown:visible');

export async function searchProduct(page: Page) {
  const id = randomUUID().slice(0, 8);
  const response = await page.request.post('/api/v1/master/products', {
    headers: { Origin: 'http://127.0.0.1:5174' },
    data: { code: `B6G2-${id}`, name: `腈纶联想验收-${id}`, model: `MX-${id}` },
  });
  expect(response.ok()).toBe(true);
  return masterItemSchema.parse((await response.json()).data);
}

export function mockProduct(code: string, extra: Partial<MasterItem> = {}): MasterItem {
  return { code, name: `腈纶-${code}`, active: true, inventoryEligible: true, ...extra };
}

export async function masterPage(route: Route, items: MasterItem[]) {
  await route.fulfill({
    json: { code: 'OK', message: '', data: { items, total: items.length, page: 1, pageSize: 20 } },
  });
}
