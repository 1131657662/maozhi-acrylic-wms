import { expect, type Page } from '@playwright/test';
import { detailSchema, shipmentListSchema, type Detail } from '@wms/contracts';
import { e2eDatabase, inventoryCell, post } from './inventory-helpers';

export async function shipmentOrder(page: Page, multi = false): Promise<Detail> {
  const db = e2eDatabase();
  try {
    const cell = await inventoryCell(db);
    await db.run("UPDATE stock SET packages=200,weight_tonnes='60.0000' WHERE product_code=?", [cell.productCode]);
    const line = { productCode: cell.productCode, plannedPackages: 100, plannedWeightGrams: 30000000 };
    const response = await post(page, '/outbound', {
      warehouseCode: cell.warehouseCode,
      customerCode: 'DEMO-CUST-1',
      vehicleNo: '苏F80807',
      lines: multi ? [line, { ...line, plannedPackages: 10, plannedWeightGrams: 3000000 }] : [line],
    });
    expect(response.status()).toBe(200);
    return detailSchema.parse((await response.json()).data);
  } finally {
    await db.close();
  }
}
export async function inputShipment(page: Page, packages: number, tonnes: string): Promise<void> {
  await page.getByRole('button', { name: '本次发货', exact: true }).click();
  await page.getByRole('spinbutton', { name: '本次实发包数 1', exact: true }).fill(String(packages));
  await page.getByRole('spinbutton', { name: '本次实发吨数 1', exact: true }).fill(tonnes);
}
export async function sendShipment(page: Page): Promise<void> {
  await page.getByRole('button', { name: '确认本次发货', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认发货', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}
export async function shipmentRecords(page: Page, id: string) {
  const response = await page.request.get(`/api/v1/outbound/${id}/shipments`);
  expect(response.status()).toBe(200);
  return shipmentListSchema.parse((await response.json()).data);
}

export async function shipmentDialogScreenshots(page: Page, name: string): Promise<void> {
  for (const width of [1440, 1280]) {
    await page.setViewportSize({ width, height: 960 });
    await page.screenshot({ path: `.local/evidence/${name}-${width}.png`, animations: 'disabled' });
  }
}
