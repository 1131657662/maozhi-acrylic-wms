import { test, expect, type Page } from '@playwright/test';

async function openStock(page: Page) {
  await page.goto('/user/login');
  await page.getByLabel('用户名', { exact: true }).fill('owner');
  await page.getByLabel('密码', { exact: true }).fill('e2e-only-password');
  await page.getByRole('button', { name: /登\s*录/ }).click();
  await expect(page.getByRole('heading', { name: '出库工作台' })).toBeVisible();
  await page.goto('/stock');
}
async function stockNumbers(page: Page) {
  return {
    packages: await page
      .locator('[data-testid="stock-row-packages"], [data-testid="stock-subtotal-packages"]')
      .allTextContents(),
    tonnes: await page
      .locator('[data-testid="stock-row-tonnes"], [data-testid="stock-subtotal-tonnes"]')
      .allTextContents(),
  };
}

test('B1a2 单来源库存与流水；无跨源总计路径，SQL夹具值与页面逐项一致', async ({ page }) => {
  const errors: string[] = [];
  const stockRequests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (request.url().includes('/api/v1/stock')) stockRequests.push(request.url());
  });
  await openStock(page);
  await expect(page.getByRole('tab')).toHaveCount(3);
  const sources = [
    {
      source: 'erp-product',
      label: 'ERP 历史商品',
      packages: '18',
      tonnes: '5.4460',
      rows: ['7', '11'],
      weights: ['2.1175', '3.3285'],
    },
    {
      source: 'sku-spec',
      label: 'SPEC 条码目录商品',
      packages: '30',
      tonnes: '9.1440',
      rows: ['13', '17'],
      weights: ['3.9130', '5.2310'],
    },
  ];
  for (const source of sources) {
    await page.getByRole('tab', { name: source.label, exact: true }).click();
    await expect(page.getByTestId('source-stock')).toHaveAttribute('data-source', source.source);
    await expect(page.getByTestId('stock-subtotal-packages')).toHaveText(source.packages);
    await expect(page.getByTestId('stock-subtotal-tonnes')).toHaveText(source.tonnes);
    const numbers = await stockNumbers(page);
    expect(numbers.packages.sort()).toEqual([source.packages, ...source.rows].sort());
    expect(numbers.tonnes.sort()).toEqual([source.tonnes, ...source.weights].sort());
    expect(numbers.packages).not.toContain('48');
    expect(numbers.tonnes).not.toContain('14.5900');
    await expect(page.getByTestId('journal-row-packages')).toHaveCount(2);
    const journalNumbers = {
      packages: await page.getByTestId('journal-row-packages').allTextContents(),
      tonnes: await page.getByTestId('journal-row-tonnes').allTextContents(),
    };
    expect(journalNumbers).toEqual({ packages: ['1', '1'], tonnes: ['0.3000', '0.3000'] });
    await expect(page.locator('.ant-spin-blur')).toHaveCount(0);
    await page.screenshot({ path: `.local/evidence/b1a2-stock-${source.source}-1440.png`, fullPage: true });
    console.log(
      `B1A2_BROWSER ${JSON.stringify({ source: source.source, numbers, journalNumbers, crossSourceMatches: 0 })}`,
    );
  }
  await page.setViewportSize({ width: 1280, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy();
  await page.screenshot({ path: '.local/evidence/b1a2-stock-spec-1280.png', fullPage: true });
  await page.getByRole('tab', { name: '未归属商品（仅明细）' }).click();
  await expect(page.getByText('这些商品尚未归属 ERP 或 SPEC，暂不计算小计')).toBeVisible();
  await expect(page.getByTestId('stock-subtotal-packages')).toHaveCount(0);
  await expect(page.getByTestId('stock-subtotal-tonnes')).toHaveCount(0);
  await expect(page.getByRole('cell', { name: 'SRC-MISSING', exact: true })).toBeVisible();
  expect(
    stockRequests.every(
      (url) => new URL(url).pathname.startsWith('/api/v1/stock/by-source') && new URL(url).searchParams.has('source'),
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
});

test('B1a2 切换来源加载时不串旧数据，错源响应被拦截且可以重试', async ({ page }) => {
  await openStock(page);
  await expect(page.getByTestId('stock-subtotal-packages')).toHaveText('18');
  let release: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  let incorrect = true;
  await page.route('**/api/v1/stock/by-source?source=sku-spec', async (route) => {
    await waiting;
    const response = await route.fetch();
    const body = await response.json();
    if (incorrect) body.data.source = 'erp-product';
    await route.fulfill({ response, json: body });
  });
  await page.getByRole('tab', { name: 'SPEC 条码目录商品', exact: true }).click();
  await expect(page.getByTestId('stock-source-label')).toContainText('SPEC 条码目录商品');
  await expect(page.getByTestId('source-stock')).toHaveCount(0);
  await expect(page.locator('.ant-skeleton')).toBeVisible();
  release?.();
  await expect(page.getByText('此来源库存加载失败，已停止展示旧数据')).toBeVisible();
  await expect(page.getByTestId('stock-subtotal-packages')).toHaveCount(0);
  incorrect = false;
  await page.getByRole('button', { name: /重\s*试/ }).click();
  await expect(page.getByTestId('stock-subtotal-packages')).toHaveText('30');
  await page.getByRole('tab', { name: 'ERP 历史商品', exact: true }).click();
  await expect(page.getByTestId('stock-subtotal-packages')).toHaveText('18');
  console.log('B1A2_SWITCH loading_old_values=0; wrong_source_display=0; retry=30; switch_back=18');
});

test('B1a2 本来源空态与无权限不显示其他来源数据', async ({ page }) => {
  let forbidden = false;
  await page.route('**/api/v1/stock/by-source?source=erp-product', (route) =>
    route.fulfill({
      status: forbidden ? 403 : 200,
      json: {
        code: forbidden ? 'FORBIDDEN' : 'OK',
        message: '验收拒绝',
        traceId: 'source-state',
        data: forbidden ? null : { source: 'erp-product', items: [], subtotal: { packages: 0, weightGrams: 0 } },
      },
    }),
  );
  await openStock(page);
  await expect(page.getByText('本来源暂无已确认库存；条码目录重量不等于库存')).toBeVisible();
  await expect(page.getByTestId('stock-subtotal-packages')).toHaveText('0');
  forbidden = true;
  await page.reload();
  await expect(page.getByText('无权查看此来源库存')).toBeVisible();
  await expect(page.getByTestId('source-stock')).toHaveCount(0);
});
