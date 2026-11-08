import { expect } from '@playwright/test';
import { test } from './list-test';
import { randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { e2eDatabase, post, receipt, inventoryCell, screenshotWidths } from './inventory-helpers';
import { confirmedDocument, previewFor } from './lifecycle-helpers';
import { businessFingerprint, injectLifecycleFailure } from '../../apps/api/tests/lifecycle-fixture';

for (const kind of ['inbound', 'outbound'] as const) {
  test(`B2a ${kind} 撤销界面/20并发/补偿净零/终态证据`, async ({ page }) => {
    test.setTimeout(90000);
    const db = e2eDatabase();
    try {
      const doc = await confirmedDocument(page, db, kind);
      const original = await db.all('SELECT * FROM scan_facts WHERE plan_id=?', [doc.id]);
      await page.goto(`/${kind}/${doc.id}`);
      await page.getByRole('button', { name: '核对撤销误确认' }).click();
      await page.getByLabel('误确认原因', { exact: true }).fill('误点确认，复核原操作后冲回；不涉及实物退货');
      await screenshotWidths(page, `b2a-${kind}-reverse-preview`);
      let failedKey: string | undefined;
      if (kind === 'inbound') {
        const before = await businessFingerprint(db);
        await injectLifecycleFailure(db, 'operation_log', 'INSERT');
        try {
          const failedResponse = page.waitForResponse((r) => r.url().endsWith(`/${kind}/${doc.id}/reverse`));
          await page.getByRole('button', { name: '确认撤销入账', exact: true }).click();
          const failed = await failedResponse;
          expect(failed.status()).toBe(500);
          failedKey = failed.request().headers()['idempotency-key'];
          await expect(page.getByText(/原因与原请求已保留/)).toBeVisible();
          await expect(page.getByLabel('误确认原因', { exact: true })).toHaveValue(
            '误点确认，复核原操作后冲回；不涉及实物退货',
          );
          expect(await businessFingerprint(db)).toEqual(before);
        } finally {
          await db.run('DROP TRIGGER b2a_fail');
        }
      }
      const response = page.waitForResponse(
        (r) => r.url().endsWith(`/${kind}/${doc.id}/reverse`) && r.request().method() === 'POST',
      );
      await page.getByRole('button', { name: '确认撤销入账', exact: true }).click();
      const saved = await response;
      expect(saved.status()).toBe(200);
      if (failedKey) {
        expect(saved.request().headers()['idempotency-key']).toBe(failedKey);
        console.log('B2A_UI_RECOVERY reason_preserved=true same_key=true failed_transaction_unchanged=true retry=200');
      }
      const replies = await Promise.all(
        Array.from({ length: 20 }, () =>
          post(
            page,
            `/${kind}/${doc.id}/reverse`,
            saved.request().postDataJSON(),
            saved.request().headers()['idempotency-key']!,
          ),
        ),
      );
      expect(replies.map((r) => r.status())).toEqual(Array(20).fill(200));
      expect(
        Number(
          (
            await db.get('SELECT COUNT(*) AS n FROM inventory_operations WHERE operation_type=? AND target_id=?', [
              `${kind}.reverse`,
              doc.id,
            ])
          )?.n,
        ),
      ).toBe(1);
      await expect(page.getByText('已撤销确认 · 原单已终结', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: /核对并确认|核对撤销|编辑计划/ })).toHaveCount(0);
      await screenshotWidths(page, `b2a-${kind}-cancelled`);
      expect(await db.all('SELECT * FROM scan_facts WHERE plan_id=?', [doc.id])).toEqual(original);
      const sql = readFileSync('scripts/sql/verify-document-lifecycle.sql', 'utf8'),
        evidence = [];
      for (const statement of sql
        .replace(/^--.*$/gm, '')
        .split(';')
        .filter((s) => s.trim())) {
        const rows = await db.all(statement);
        expect(
          rows.every((r) => ('balanced' in r ? Number(r.balanced) === 1 : Number(r.mismatches) === 0)),
        ).toBeTruthy();
        evidence.push(rows);
        console.log(`B2A_E2E_SQL ${JSON.stringify(rows)}`);
      }
      writeFileSync(`.local/evidence/b2a-${kind}-sql.json`, JSON.stringify(evidence, null, 2));
      console.log(
        `B2A_E2E ${kind} repeat_concurrent=20 statuses=${replies.map((r) => r.status()).join(',')} compensation=1 delta_net=0 facts_unchanged=true`,
      );
    } finally {
      await db.close();
    }
  });
  test(`B2a ${kind} HTTP逐阶段故障回滚及原键恢复`, async ({ page }) => {
    test.setTimeout(90000);
    const db = e2eDatabase();
    try {
      const doc = await confirmedDocument(page, db, kind),
        preview = await previewFor(page, kind, doc.id);
      const input = { reason: '隔离故障恢复验收', expectedToken: preview.token },
        key = randomUUID();
      const before = await businessFingerprint(db);
      const stages: [string, 'INSERT' | 'UPDATE'][] = [
        ['inventory_operations', 'INSERT'],
        ['stock', 'UPDATE'],
        ['stock_journal', 'INSERT'],
        [kind === 'inbound' ? 'inbound_receipts' : 'outbound_orders', 'UPDATE'],
        ['document_closures', 'INSERT'],
        ['operation_log', 'INSERT'],
        ['idempotent_commands', 'INSERT'],
      ];
      for (const [table, event] of stages) {
        await injectLifecycleFailure(db, table, event);
        try {
          expect((await post(page, `/${kind}/${doc.id}/reverse`, input, key)).status()).toBe(500);
        } finally {
          await db.run('DROP TRIGGER b2a_fail');
        }
        expect(await businessFingerprint(db)).toEqual(before);
        console.log(`B2A_E2E_FAILURE ${kind} after=${table} status=500 partial_writes=0 database_unchanged=true`);
      }
      expect((await post(page, `/${kind}/${doc.id}/reverse`, input, key)).status()).toBe(200);
      console.log(`B2A_E2E_RECOVERY ${kind} original_key_retry=200`);
    } finally {
      await db.close();
    }
  });
}
test('B2a 下游依赖可见且零写入；未入账作废不占库存/不复用原号', async ({ page }) => {
  test.setTimeout(90000);
  const db = e2eDatabase();
  try {
    const doc = await confirmedDocument(page, db, 'inbound'),
      old = await previewFor(page, 'inbound', doc.id);
    const later = await receipt(page, doc);
    expect((await post(page, `/inbound/${later.id}/confirm`, {})).status()).toBe(200);
    const before = await businessFingerprint(db);
    const rejected = await post(page, `/inbound/${doc.id}/reverse`, {
      reason: '下游阻断验收',
      expectedToken: old.token,
    });
    expect(rejected.status()).toBe(409);
    expect((await rejected.json()).code).toBe('DOWNSTREAM_DEPENDENCY');
    expect(await businessFingerprint(db)).toEqual(before);
    await page.goto(`/inbound/${doc.id}`);
    await expect(page.getByText(/存在后续库存动作/)).toBeVisible();
    await expect(page.getByRole('button', { name: '核对撤销误确认' })).toHaveCount(0);
    await screenshotWidths(page, 'b2a-dependency-blocked');
    const cell = await inventoryCell(db),
      pending = await receipt(page, cell);
    await page.goto(`/inbound/${pending.id}`);
    await page.getByRole('button', { name: '核对并作废' }).click();
    await page.getByLabel('作废原因', { exact: true }).fill('重复登记，尚未确认入账');
    await screenshotWidths(page, 'b2a-void-preview');
    await page.getByRole('button', { name: '确认作废', exact: true }).click();
    await expect(page.getByText('已作废 · 未入账', { exact: true })).toBeVisible();
    expect(
      Number((await db.get('SELECT COUNT(*) AS n FROM stock_journal WHERE inbound_receipt_id=?', [pending.id]))?.n),
    ).toBe(0);
    expect((await db.get('SELECT packages FROM stock WHERE product_code=?', [cell.productCode]))?.packages).toBe(6);
    await screenshotWidths(page, 'b2a-voided');
    console.log(
      'B2A_E2E dependency=409 all_tables_unchanged=true blocker_visible=true void_stock_unchanged=true void_journal=0',
    );
  } finally {
    await db.close();
  }
});
