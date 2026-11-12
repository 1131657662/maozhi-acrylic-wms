import { expect, type Page } from '@playwright/test';

export async function columnMetrics(page: Page, kind: string) {
  return page.getByTestId(`${kind}-list`).evaluate((element) => {
    const body = element.querySelector<HTMLElement>('.ant-table-body')!;
    const container = element.querySelector('.ant-table-container')!.getBoundingClientRect();
    const headers = Array.from(element.querySelectorAll<HTMLElement>('thead th[data-column-key]'));
    return {
      widths: Object.fromEntries(
        headers.map((header) => [header.dataset.columnKey!, header.getBoundingClientRect().width]),
      ),
      order: headers.map((header) => header.dataset.columnKey!),
      alignment: Object.fromEntries(
        headers
          .filter((header) => ['receiptNo', 'orderNo', 'status'].includes(header.dataset.columnKey!))
          .map((header) => {
            const cell = element.querySelector(
              `tbody tr[data-row-key] td[data-export-field="${header.dataset.columnKey}"]`,
            )!;
            return [header.dataset.columnKey!, header.getBoundingClientRect().x - cell.getBoundingClientRect().x];
          }),
      ),
      scrollWidth: body.scrollWidth,
      clientWidth: body.clientWidth,
      scrollLeft: body.scrollLeft,
      pageScrollWidth: document.documentElement.scrollWidth,
      pageClientWidth: document.documentElement.clientWidth,
      rect: { x: container.x, y: container.y, width: container.width, height: container.height },
    };
  });
}

export async function resizeColumn(page: Page, key: string, pixels: number) {
  const handle = page.getByTestId(`resize-${key}`);
  await expect(handle).toBeVisible();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + pixels, box.y + box.height / 2, { steps: 10 });
  await page.mouse.up();
}

export async function toggleColumn(page: Page, kind: string, label: string) {
  await page.getByTestId(`${kind}-list`).getByRole('img', { name: 'setting', exact: true }).click();
  // Additional business columns may put the optional fields beyond the virtual tree's rendered window.
  if ((await page.getByRole('treeitem').filter({ hasText: label }).count()) === 0)
    await page.locator('.ant-tree-list-holder').evaluateAll((nodes) =>
      nodes.forEach((node) => {
        node.scrollTop = node.scrollHeight;
      }),
    );
  await page.getByRole('treeitem').filter({ hasText: label }).locator('.ant-tree-checkbox').click();
  await page.getByRole('heading', { name: kind === 'inbound' ? '入库记录' : '出库工作台', exact: true }).click();
}

export async function resetColumns(page: Page, kind: string, widthsOnly = false) {
  await page.getByTestId(`${kind}-list`).getByRole('img', { name: 'setting', exact: true }).click();
  await page
    .getByRole('button', { name: widthsOnly ? '重置列宽' : '重置列设置', exact: true })
    .click({ timeout: 8000 });
  await page.getByRole('heading', { name: kind === 'inbound' ? '入库记录' : '出库工作台', exact: true }).click();
}

export async function reorderColumn(page: Page, kind: string) {
  await page.getByTestId(`${kind}-list`).getByRole('img', { name: 'setting', exact: true }).click();
  await page.locator('.ant-tree-list-holder').evaluateAll((nodes) =>
    nodes.forEach((node) => {
      node.scrollTop = 0;
    }),
  );
  const source = page
    .getByRole('treeitem')
    .filter({ hasText: kind === 'inbound' ? /^总重量（吨）$/ : /^实发重量（吨）$/ })
    .locator('.ant-tree-node-content-wrapper');
  const target = page
    .getByRole('treeitem')
    .filter({ hasText: kind === 'inbound' ? /^供应商$/ : /^仓库$/ })
    .locator('.ant-tree-node-content-wrapper');
  await source.hover();
  const start = (await source.boundingBox())!;
  const end = (await target.boundingBox())!;
  await page.mouse.move(start.x + 40, start.y + start.height / 2);
  await page.mouse.down();
  await page.mouse.move(start.x + 50, start.y + start.height / 2, { steps: 5 });
  await page.mouse.move(end.x + 40, end.y + end.height - 2, { steps: 12 });
  await page.mouse.move(end.x + 41, end.y + end.height - 2);
  await expect(page.locator('.ant-tree-drop-indicator')).toBeVisible();
  await page.mouse.up();
  await page.getByRole('heading', { name: kind === 'inbound' ? '入库记录' : '出库工作台', exact: true }).click();
}
