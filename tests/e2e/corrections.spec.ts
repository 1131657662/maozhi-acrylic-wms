import { expect } from '@playwright/test';
import { test } from './list-test';
import { e2eDatabase, screenshotWidths } from './inventory-helpers';
import { confirmedDocument } from './lifecycle-helpers';

for (const kind of ['inbound', 'outbound'] as const)
  test(`B5a ${kind} 更正抽屉、二次确认、详情时间线与原键重试`, async ({ page }) => {
    test.setTimeout(90000);
    const db = e2eDatabase(),
      errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      const doc = await confirmedDocument(page, db, kind);
      const original = (await (await page.request.get(`/api/v1/${kind}/${doc.id}`)).json()).data;
      const before = await db.get('SELECT packages,weight_tonnes FROM stock WHERE product_code=?', [doc.productCode]);
      await page.goto(`/${kind}/${doc.id}`);
      const footer = page.getByTestId('document-bottom-actions');
      await expect(footer.getByRole('button', { name: /打\s*印/ })).toBeDisabled();
      await footer
        .getByRole('button', { name: /打\s*印/ })
        .locator('..')
        .hover();
      await expect(page.getByRole('tooltip')).toHaveText('打印暂不可用');
      await expect(page.locator('button.ant-btn-primary:visible')).toHaveCount(1);
      await footer.getByRole('button', { name: '数量更正' }).click();
      const drawer = page.getByRole('dialog', { name: /数量更正/ });
      await expect(drawer.getByText('原单值：1 包 / 0.3025 吨')).toBeVisible();
      await drawer.getByLabel(`${doc.productCode} 更正后包数`).fill('2');
      await drawer.getByLabel('更正原因', { exact: true }).fill('B5a 只修正包数，吨数保持原值');
      await expect(drawer.getByText('本次差额：+1 包 / +0.0000 吨')).toBeVisible();
      await screenshotWidths(page, `b5a-${kind}-drawer`);
      await drawer.getByRole('button', { name: '核对并提交' }).click();
      await page.getByRole('button', { name: '返回核对', exact: true }).click();
      expect(
        Number(
          (
            await db.get(
              'SELECT COUNT(*) AS n FROM document_corrections WHERE ' +
                (kind === 'inbound' ? 'inbound_receipt_id' : 'outbound_order_id') +
                '=?',
              [doc.id],
            )
          )?.n,
        ),
      ).toBe(0);
      const attempts: { key?: string; body: string | null }[] = [];
      await page.route(`**/api/v1/${kind}/${doc.id}/corrections`, async (route) => {
        if (route.request().method() !== 'POST') return route.continue();
        attempts.push({ key: route.request().headers()['idempotency-key'], body: route.request().postData() });
        const response = await route.fetch();
        if (attempts.length === 1) {
          expect(response.status()).toBe(200);
          return route.abort('connectionreset');
        }
        return route.fulfill({ response });
      });
      await drawer.getByRole('button', { name: '核对并提交' }).click();
      await page.getByRole('button', { name: '确认更正并入账' }).click();
      await expect(drawer.getByText(/原值、填写内容和请求已保留/)).toBeVisible();
      await expect(drawer.getByLabel(`${doc.productCode} 更正后包数`)).toHaveValue('2');
      await expect(drawer.getByLabel('更正原因', { exact: true })).toHaveValue('B5a 只修正包数，吨数保持原值');
      const retry = page.getByRole('button', { name: '确认更正并入账', exact: true });
      await expect(retry).toBeEnabled();
      await expect(retry).not.toHaveClass(/ant-btn-loading/);
      await retry.evaluate((button) => {
        (button as HTMLButtonElement).click();
        (button as HTMLButtonElement).click();
      });
      await expect(drawer).toHaveCount(0);
      expect(attempts).toHaveLength(2);
      expect(attempts[1]).toEqual(attempts[0]);
      const detail = (await (await page.request.get(`/api/v1/${kind}/${doc.id}`)).json()).data;
      const panel = page.getByTestId('correction-summary');
      await expect(panel).toContainText('有效数量');
      await expect(panel).toContainText('2 包 / 0.3025 吨');
      await expect(panel).toContainText('+1 包 / +0.0000 吨');
      await expect(panel).toContainText(detail.corrections.latest.number);
      await expect(panel).toContainText('更正1 · 已被更正：+1 包');
      expect(detail.lines).toEqual(original.lines);
      expect(detail.businessDate).toBe(original.businessDate);
      const after = await db.get('SELECT packages,weight_tonnes FROM stock WHERE product_code=?', [doc.productCode]);
      expect(Number(after?.packages) - Number(before?.packages)).toBe(kind === 'inbound' ? 1 : -1);
      expect(after?.weight_tonnes).toBe(before?.weight_tonnes);
      await screenshotWidths(page, `b5a-${kind}-detail`);
      expect(errors).toEqual([]);
      console.log(
        'B5A_UI_CORRECTION',
        JSON.stringify({
          kind,
          before,
          after,
          sameKeyBodyRetry: true,
          confirmationCancelledWrites: 0,
          effective: detail.corrections.effective,
          cumulativeDelta: detail.corrections.delta,
          latest: detail.corrections.latest,
          originalUnchanged: true,
          primaryButtons: 1,
          printDisabled: true,
          pageErrors: errors,
        }),
      );
    } finally {
      await db.close();
    }
  });

for (const kind of ['inbound', 'outbound'] as const)
  test(`B5a ${kind} 列表更多入口与选择/操作区域零位移`, async ({ page }) => {
    test.setTimeout(90000);
    const db = e2eDatabase();
    try {
      const doc = await confirmedDocument(page, db, kind);
      const detail = (await (await page.request.get(`/api/v1/${kind}/${doc.id}`)).json()).data;
      const number = detail.receiptNo ?? detail.orderNo;
      for (const width of [1440, 1280]) {
        await page.setViewportSize({ width, height: 960 });
        await page.goto(`${kind === 'inbound' ? '/inbound' : '/'}?keyword=${encodeURIComponent(number)}`);
        const results = page.getByTestId('list-results');
        const row = results.getByRole('row').filter({ hasText: number });
        await expect(row).toBeVisible();
        await expect(page.locator('.ant-spin-blur')).toHaveCount(0);
        const box = () =>
          results.locator('.ant-table').evaluate((table) => {
            const r = table.getBoundingClientRect();
            return { x: r.x + scrollX, y: r.y + scrollY, width: r.width };
          });
        const before = await box();
        await row.getByRole('checkbox').check();
        await expect(page.getByText('已选择 1 条；变更筛选将清空选择')).toBeVisible();
        const selected = await box();
        expect(selected).toEqual(before);
        await expect(row.getByRole('button', { name: '数量更正', exact: true })).toHaveCount(0);
        await expect(row.getByRole('button', { name: '更多 ▾' })).toHaveCount(1);
        await expect(page.locator('button.ant-btn-primary:visible')).toHaveCount(1);
        await row.getByRole('button', { name: '更多 ▾' }).click();
        await page.getByRole('menuitem', { name: '数量更正' }).click();
        await expect(page.getByRole('dialog', { name: /数量更正/ })).toBeVisible();
        const opened = await box();
        expect(opened).toEqual(before);
        await page.screenshot({
          path: `.local/evidence/b5a-${kind}-more-${width}.png`,
          fullPage: true,
          animations: 'disabled',
        });
        await page
          .getByRole('dialog', { name: /数量更正/ })
          .getByRole('button', { name: /取\s*消/ })
          .click();
        await expect(page.getByRole('dialog')).toHaveCount(0);
        expect(await box()).toEqual(before);
        console.log(
          'B5A_UI_POSITION',
          JSON.stringify({
            kind,
            width,
            before,
            selected,
            opened,
            displacement: { x: 0, y: 0 },
            rowEntry: '更多 ▾',
            primaryButtons: 1,
          }),
        );
      }
    } finally {
      await db.close();
    }
  });
