import { test } from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import type { ListPreferenceColumns, ListPreferences } from '@wms/contracts';
import { PreferenceStore } from '../../web/src/features/list-preferences/store.ts';

const record = (columns: ListPreferenceColumns): ListPreferences => ({
  schemaVersion: 1,
  columns,
  updatedAt: '2026-11-10 00:00:00.000',
});
function storage() {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  });
  return data;
}
function pendingWrites() {
  const requests: { columns: ListPreferenceColumns; resolve: (value: ListPreferences) => void }[] = [];
  const save = (columns: ListPreferenceColumns) =>
    new Promise<ListPreferences>((resolve) => requests.push({ columns, resolve }));
  return { requests, save };
}

test('列偏好500ms防抖，单写者合并后续编辑，迟到GET/PUT不覆盖新值', async (t) => {
  storage();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const store = new PreferenceStore('one', 'inbound');
  const { requests, save } = pendingWrites();
  const disconnect = store.connect(save);
  store.received({ ...record({}), updatedAt: null }, store.revision);
  store.change({ receiptNo: { width: 320 } });
  t.mock.timers.tick(499);
  assert.equal(requests.length, 0);
  store.change({ receiptNo: { width: 340 } });
  t.mock.timers.tick(500);
  assert.deepEqual(requests[0]!.columns, { receiptNo: { width: 340 } });
  store.change({ receiptNo: { width: 360 } });
  t.mock.timers.tick(500);
  assert.equal(requests.length, 1);
  requests[0]!.resolve(record(requests[0]!.columns));
  await setImmediate();
  assert.equal(store.getSnapshot().columns.receiptNo?.width, 360);
  t.mock.timers.tick(500);
  const oldReadRevision = store.revision;
  requests[1]!.resolve(record(requests[1]!.columns));
  await setImmediate();
  store.received(record({ receiptNo: { width: 280 } }), oldReadRevision);
  assert.equal(store.getSnapshot().columns.receiptNo?.width, 360);
  assert.equal(store.getSnapshot().dirty, false);
  disconnect();
});

test('列偏好离线失败保留缓存，下次进入续传；重置成功清缓存', async (t) => {
  const data = storage();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const first = new PreferenceStore('one', 'inbound');
  const leave = first.connect(async () => {
    throw new Error('offline');
  });
  first.received(undefined, 0);
  first.change({ receiptNo: { width: 380 } });
  t.mock.timers.tick(500);
  await setImmediate();
  leave();
  assert.equal(JSON.parse(data.get(first.key)!).dirty, true);
  const next = new PreferenceStore('one', 'inbound');
  const saved: ListPreferenceColumns[] = [];
  const disconnect = next.connect(async (columns) => {
    saved.push(columns);
    return record(columns);
  });
  next.received(record({ receiptNo: { width: 220 } }), 0);
  assert.equal(next.getSnapshot().columns.receiptNo?.width, 380);
  t.mock.timers.tick(500);
  await setImmediate();
  assert.deepEqual(saved, [{ receiptNo: { width: 380 } }]);
  next.change({}, true);
  t.mock.timers.tick(500);
  await setImmediate();
  assert.equal(data.get(next.key), undefined);
  disconnect();
});

test('列偏好未完成读取不会覆盖已编辑设置，离开时取消待发送任务', (t) => {
  const data = storage();
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const store = new PreferenceStore('one', 'outbound');
  let count = 0;
  const disconnect = store.connect(async (columns) => {
    count++;
    return record(columns);
  });
  store.change({ orderNo: { width: 400 } });
  store.received(record({ orderNo: { width: 220 } }), 0);
  disconnect();
  t.mock.timers.tick(500);
  assert.equal(count, 0);
  assert.equal(store.getSnapshot().columns.orderNo?.width, 400);
  assert.equal(JSON.parse(data.get(store.key)!).dirty, true);
});
