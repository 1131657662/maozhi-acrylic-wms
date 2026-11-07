const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { request } = require('../utils/request');
const { present } = require('../utils/present');
afterEach(() => {
  delete global.wx;
});
test('小程序透传分页、只读会话及响应信封', async () => {
  global.wx = {
    getStorageSync: () => 'fixture-token',
    request: (options) => {
      assert.equal(options.header.Authorization, 'Bearer fixture-token');
      assert.match(options.url, /outbound\?page=1/);
      options.success({ statusCode: 200, data: { code: 'OK', data: { items: [], total: 0 } } });
    },
  };
  assert.deepEqual(await request('/outbound?page=1'), { items: [], total: 0 });
});
test('401 清除会话并重新登录', async () => {
  let removed = false;
  let redirected = false;
  global.wx = {
    getStorageSync: () => '',
    removeStorageSync: () => {
      removed = true;
    },
    reLaunch: () => {
      redirected = true;
    },
    request: (options) => options.success({ statusCode: 401, data: { message: '登录过期', traceId: 'trace-1' } }),
  };
  await assert.rejects(request('/outbound'), /登录过期/);
  assert.equal(removed, true);
  assert.equal(redirected, true);
});
test('吨数展示来自独立克重并保留四位小数', () => {
  const result = present({ plannedWeightGrams: 600000, actualWeightGrams: 302500, status: 'frozen' });
  assert.equal(result.actualTonnes, '0.3025');
  assert.equal(result.plannedTonnes, '0.6000');
  assert.equal(result.statusLabel, '待出库确认');
});
