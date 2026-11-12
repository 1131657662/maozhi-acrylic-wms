import { expect, type Page } from '@playwright/test';
import { post } from './inventory-helpers';
import { shipmentOrder } from './shipment-ui-helpers';

export async function dateDocument(page: Page, kind: 'inbound' | 'outbound') {
  if (kind === 'outbound') {
    const order = await shipmentOrder(page);
    const path = `/outbound/${order.id}`;
    expect(
      (
        await post(page, `${path}/shipments`, {
          revision: order.revision,
          digest: order.digest,
          lines: [{ lineId: order.lines[0]!.id, actualPackages: 40, actualWeightGrams: 12000000 }],
        })
      ).status(),
    ).toBe(200);
    return { path, number: order.orderNo };
  }
  const created = await post(page, '/inbound', {
    supplierCode: 'DEMO-SUPPLIER',
    warehouseCode: 'DEMO-WH',
    lines: [{ productCode: 'ACR-032', packages: 1, weightGrams: 300000 }],
  });
  expect(created.status()).toBe(200);
  const order = (await created.json()).data;
  const path = `/inbound/${order.id}`;
  expect((await post(page, `${path}/confirm`, {})).status()).toBe(200);
  return { path, number: order.receiptNo as string };
}
export async function openDateCorrection(page: Page) {
  await page
    .getByTestId('date-correction-panel')
    .getByRole('button', { name: /^更\s*多$/ })
    .click();
  await page.getByRole('menuitem', { name: '更正业务日期', exact: true }).click();
  await expect(page.getByRole('dialog', { name: '更正业务日期', exact: true })).toBeVisible();
}
export async function fillDateCorrection(page: Page, date: string, reason: string) {
  const drawer = page.getByRole('dialog', { name: '更正业务日期', exact: true });
  await drawer.getByLabel('新日期', { exact: true }).fill(date);
  await drawer.getByLabel('新日期', { exact: true }).press('Enter');
  await drawer.getByLabel('更正原因', { exact: true }).fill(reason);
  await drawer.getByRole('button', { name: /^提\s*交$/ }).click();
}
