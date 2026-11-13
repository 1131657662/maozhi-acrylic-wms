import { expect } from '@playwright/test';
import { test } from './list-test';
import { searchOptions, searchPopup, searchProduct, mockProduct, masterPage } from './master-search-helpers';

test('B6g-2 商品全拼、首字母、编码片段、型号通过 q 匹配，20 条分页', async ({ page }) => {
  const product = await searchProduct(page);
  await page.goto('/inbound/new');
  const input = page.getByLabel('商品', { exact: true });
  for (const word of ['jl', 'jinglun', product.code.slice(5), product.model!]) {
    const response = page.waitForResponse((r) => new URL(r.url()).searchParams.get('q') === word);
    await input.fill(word);
    const result = await response;
    expect(new URL(result.url()).searchParams.get('pageSize')).toBe('20');
    expect(new URL(result.url()).searchParams.get('status')).toBe('active');
    expect(new URL(result.url()).searchParams.get('scope')).toBe('inventory');
    await expect(searchOptions(page).filter({ hasText: product.code })).toContainText(product.name);
    await expect(searchOptions(page).filter({ hasText: product.code })).toContainText(product.model!);
  }
  await page.screenshot({ path: '.local/evidence/b6g-2/product-options-1440.png', fullPage: true });
});

test('B6g-2 300ms 防抖合并快速输入，空白不查，1 字符起查', async ({ page }) => {
  const requests: { q: string | null; time: number }[] = [];
  await page.route('**/api/v1/master/products?**', async (route) => {
    requests.push({ q: new URL(route.request().url()).searchParams.get('q'), time: Date.now() });
    await masterPage(route, []);
  });
  await page.goto('/inbound/new');
  const input = page.getByLabel('商品', { exact: true });
  await input.fill(' ');
  await page.waitForTimeout(400);
  expect(requests).toEqual([]);
  await page.clock.install();
  await input.fill('j');
  await page.clock.runFor(100);
  await input.fill('jl');
  await page.clock.runFor(299);
  expect(requests).toEqual([]);
  await page.clock.runFor(1);
  await expect.poll(() => requests.map((r) => r.q)).toEqual(['jl']);
  await input.fill('x');
  await page.clock.runFor(300);
  await expect.poll(() => requests.map((r) => r.q)).toEqual(['jl', 'x']);
  console.log('B6G2_DEBOUNCE rapid_inputs=2 requests=1 before_300ms=0 min_characters=1');
});

test('B6g-2 加载显示小 Spin，零结果显示商品空态', async ({ page }) => {
  let release!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/master/products?**', async (route) => {
    await blocked;
    await masterPage(route, []);
  });
  await page.goto('/inbound/new');
  await page.getByLabel('商品', { exact: true }).fill('查不到');
  await expect(searchPopup(page).getByRole('status', { name: '正在搜索' })).toBeVisible();
  await expect(searchPopup(page)).not.toContainText('没有匹配的商品');
  await page.screenshot({ path: '.local/evidence/b6g-2/product-loading-1440.png', fullPage: true });
  release();
  await expect(searchPopup(page)).toContainText('没有匹配的商品，换个关键词试试');
  await expect(searchPopup(page).getByRole('status', { name: '正在搜索' })).toHaveCount(0);
  await page.screenshot({ path: '.local/evidence/b6g-2/product-empty-1440.png', fullPage: true });
});

test('B6g-2 旧搜索响应晚到不覆盖新词，防抖期间不展示旧候选', async ({ page }) => {
  let release!: () => void;
  let oldStarted = false;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/v1/master/products?**', async (route) => {
    const q = new URL(route.request().url()).searchParams.get('q')!;
    if (q === 'old') {
      oldStarted = true;
      await blocked;
    }
    await masterPage(route, [mockProduct(q === 'old' ? 'OLD' : 'NEW')]);
  });
  await page.goto('/inbound/new');
  const input = page.getByLabel('商品', { exact: true });
  await input.fill('old');
  await expect.poll(() => oldStarted).toBe(true);
  await input.fill('new');
  await expect(searchOptions(page).filter({ hasText: 'NEW' })).toBeVisible();
  release();
  await page.waitForTimeout(400);
  await expect(searchOptions(page).filter({ hasText: 'OLD' })).toHaveCount(0);
  await expect(searchOptions(page).filter({ hasText: 'NEW' })).toBeVisible();
  await input.fill('n');
  await expect(searchOptions(page)).toHaveCount(0);
});

test('B6g-2 停用和无库存资格商品不进入候选，旧 keyword 列表仍可搜索', async ({ page }) => {
  const product = await searchProduct(page);
  const response = await page.request.patch(`/api/v1/master/products/${product.code}`, {
    headers: { Origin: 'http://127.0.0.1:5174' },
    data: { active: false },
  });
  expect(response.ok()).toBe(true);
  await page.goto('/inbound/new');
  for (const word of [product.code, 'SRC-LOCAL']) {
    await page.getByLabel('商品', { exact: true }).fill(word);
    await expect(searchPopup(page)).toContainText('没有匹配的商品，换个关键词试试');
    await expect(searchOptions(page)).toHaveCount(0);
  }
  await page.goto('/master-data');
  const legacy = page.waitForResponse((r) => new URL(r.url()).searchParams.get('keyword') === product.code);
  await page.getByLabel('搜索基础资料').fill(product.code);
  await page.getByLabel('搜索基础资料').press('Enter');
  expect((await legacy).ok()).toBe(true);
  await expect(page.getByRole('row').filter({ hasText: product.code })).toContainText(product.name);
});

test('B6g-2 键盘上下选择回车确认，表单值保留，重开草稿回填且停用值不混入候选', async ({ page }) => {
  const product = await searchProduct(page);
  await page.goto('/inbound/new');
  const input = page.getByLabel('商品', { exact: true });
  await input.fill(product.code);
  await expect(searchOptions(page).filter({ hasText: product.code })).toBeVisible();
  await input.press('ArrowDown');
  await input.press('ArrowUp');
  await input.press('Enter');
  const field = page.locator('.ant-form-item').filter({ has: input }).first();
  await expect(field).toContainText(product.name);
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('wms-form-draft:owner:inbound:new')))
    .toContain(product.code);
  await page.request.patch(`/api/v1/master/products/${product.code}`, {
    headers: { Origin: 'http://127.0.0.1:5174' },
    data: { active: false },
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.reload();
  await page.getByRole('button', { name: /^恢\s*复$/ }).click();
  await expect(field).toContainText(product.name);
  await input.fill(product.code);
  await expect(searchPopup(page)).toContainText('没有匹配的商品，换个关键词试试');
  await expect(searchOptions(page)).toHaveCount(0);
  await input.press('Escape');
  await expect(searchPopup(page)).toHaveCount(0);
  await expect(field).toContainText(product.name);
});
