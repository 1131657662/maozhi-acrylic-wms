import { expect } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { test } from './list-test';
import { e2eDatabase } from './inventory-helpers';
import { inventoryCell } from './inventory-helpers';
import { actor } from '../../apps/api/tests/fixture';
import { createInbound } from '../../apps/api/src/features/inbound/create';
import { confirmInbound } from '../../apps/api/src/features/inbound/confirm';
import { commandFor } from '../../apps/api/tests/lifecycle-fixture';
import { executeLifecycle } from '../../apps/api/src/features/document-lifecycle/execute';

async function makeInbound(db: Awaited<ReturnType<typeof e2eDatabase>>) {
  const cell = await inventoryCell(db);
  const receipt = await createInbound(
    db,
    {
      supplierCode: 'DEMO-SUPPLIER',
      warehouseCode: cell.warehouseCode,
      lines: [{ productCode: cell.productCode, packages: 1, weightGrams: 302500 }],
    },
    randomUUID(),
    actor,
  );
  await confirmInbound(db, receipt.id, randomUUID(), actor);
  return { id: receipt.id, number: receipt.receiptNo };
}

async function rect(page: import('@playwright/test').Page, selector: string) {
  return page.locator(selector).evaluate((element) => {
    const box = element.getBoundingClientRect();
    return { x: box.x, y: box.y, width: box.width, height: box.height };
  });
}

function displacement(before: Awaited<ReturnType<typeof rect>>, after: Awaited<ReturnType<typeof rect>>) {
  return [
    Math.abs(after.x - before.x),
    Math.abs(after.y - before.y),
    Math.abs(after.width - before.width),
    Math.abs(after.height - before.height),
  ]
    .map((value) => `${value}px`)
    .join('/');
}

test('B6b Step 3 详情入口/批量撤销部分成功/无位移/重放幂等', async ({ page }) => {
  test.setTimeout(120000);
  const db = e2eDatabase();
  try {
    const documents = [await makeInbound(db), await makeInbound(db), await makeInbound(db)];
    await page.goto('/inbound?pageSize=50&sortBy=createdAt&direction=desc');
    const list = page.getByTestId('inbound-list');
    const row = (id: string) => list.locator(`tbody tr[data-row-key="${id}"]`);
    await expect(row(documents[0]!.id)).toBeVisible();

    await row(documents[0]!.id).getByRole('link').first().click();
    await expect(page).toHaveURL(new RegExp(`/inbound/${documents[0]!.id}$`));
    await page.getByRole('link', { name: '返回入库记录' }).click();
    await expect(row(documents[1]!.id)).toBeVisible();

    await row(documents[1]!.id).locator('td').nth(1).dblclick();
    await expect(page).toHaveURL(new RegExp(`/inbound/${documents[1]!.id}$`));
    await page.getByRole('link', { name: '返回入库记录' }).click();
    await expect(row(documents[2]!.id)).toBeVisible();

    await row(documents[2]!.id).getByRole('checkbox').check();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(`/inbound/${documents[2]!.id}$`));
    await page.getByRole('link', { name: '返回入库记录' }).click();
    await expect(row(documents[0]!.id)).toBeVisible();

    const batchClear = page.getByTestId('inbound-batch-actions').getByRole('button', { name: '清空选择' });
    if (await batchClear.count()) await batchClear.click();
    const before = await rect(page, '[data-testid="inbound-list"] .ant-table-container');
    for (const document of documents) await row(document.id).getByRole('checkbox').check();
    const afterSelection = await rect(page, '[data-testid="inbound-list"] .ant-table-container');
    const beforeBar = afterSelection;
    expect(displacement(before, afterSelection)).toBe('0px/0px/0px/0px');
    await page.getByRole('button', { name: '批量撤销' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText(documents[0]!.number);
    await expect(dialog).toContainText(documents[1]!.number);
    await expect(dialog).toContainText(documents[2]!.number);
    await expect(dialog.getByRole('button', { name: '确认批量撤销' })).toBeEnabled();
    const afterBar = await rect(page, '[data-testid="inbound-list"] .ant-table-container');
    expect(displacement(beforeBar, afterBar)).toBe('0px/0px/0px/0px');
    await page.screenshot({
      path: '.local/evidence/b6b-step3-inbound-1440.png',
      fullPage: true,
      animations: 'disabled',
    });

    await executeLifecycle(db, await commandFor(db, { kind: 'inbound', id: documents[2]!.id }));
    const request = page.waitForRequest(
      (value) => value.url().endsWith('/api/v1/web/lifecycle/batch-reverse') && value.method() === 'POST',
    );
    await dialog.getByRole('button', { name: '确认批量撤销' }).click();
    const batchRequest = await request;
    await expect(dialog).toContainText('成功 2 条，失败 1 条');
    await expect(dialog).toContainText('已入账单据只能撤销');
    const firstBody = batchRequest.postDataJSON();
    const beforeReplay = Number(
      (await db.get("SELECT COUNT(*) AS n FROM inventory_operations WHERE operation_type='inbound.reverse'"))?.n,
    );
    const replay = await page.request.post('/api/v1/web/lifecycle/batch-reverse', {
      data: firstBody,
      headers: { Origin: 'http://127.0.0.1:5174' },
    });
    const replayBody = (await replay.json()).data;
    expect(replay.status()).toBe(200);
    expect([replayBody.succeeded, replayBody.failed]).toEqual([2, 1]);
    expect(
      Number(
        (await db.get("SELECT COUNT(*) AS n FROM inventory_operations WHERE operation_type='inbound.reverse'"))?.n,
      ),
    ).toBe(beforeReplay);
    console.log(
      `B6B_STEP3_E2E entries=link,double-click,enter displacement=selection:${displacement(before, afterSelection)} batch:${displacement(
        beforeBar,
        afterBar,
      )} result=${JSON.stringify({
        total: replayBody.total,
        succeeded: replayBody.succeeded,
        failed: replayBody.failed,
        duplicateCompensation: false,
      })}`,
    );
  } finally {
    await db.close();
  }
});
