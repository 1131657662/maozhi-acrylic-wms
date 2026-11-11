import { test } from 'node:test';
import assert from 'node:assert/strict';
import { z } from 'zod';
import { request } from '../../web/src/api/client.ts';
import { ApiError, diagnosticPath } from '../../web/src/api/errors.ts';
import { onRequestError } from '../../web/src/api/error-events.ts';

test('Web 请求将错误响应归类且不显示英文异常或堆栈', async (t) => {
  const schema = z.object({ saved: z.boolean() });
  for (const [status, kind] of [
    [401, 'UNAUTHORIZED'],
    [403, 'FORBIDDEN'],
    [404, 'NOT_FOUND'],
    [409, 'CONFLICT'],
    [422, 'VALIDATION'],
    [500, 'SERVER'],
    [502, 'UNAVAILABLE'],
    [503, 'UNAVAILABLE'],
    [504, 'TIMEOUT'],
  ] as const) {
    t.mock.method(globalThis, 'fetch', async () => new Response('SQL stack Unexpected token', { status }));
    await assert.rejects(request('/inbound/secret-id?token=secret', schema), (error: unknown) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.kind, kind);
      assert.doesNotMatch(error.message, /SQL|stack|token|\d{3}/);
      return true;
    });
    t.mock.restoreAll();
  }
  assert.equal(diagnosticPath('/inbound/123?token=secret'), '/inbound/:record');
});
test('Web 请求区分断网、超时和异常数据，提交错误发出统一事件', async (t) => {
  let received: ApiError | undefined;
  const unsubscribe = onRequestError((error) => {
    received = error;
  });
  try {
    for (const [cause, kind] of [
      [new TypeError('Failed to fetch'), 'NETWORK'],
      [new DOMException('timeout', 'TimeoutError'), 'TIMEOUT'],
    ] as const) {
      t.mock.method(globalThis, 'fetch', async () => {
        throw cause;
      });
      await assert.rejects(
        request('/inbound', z.object({}), { method: 'POST' }),
        (error: unknown) => error instanceof ApiError && error.kind === kind,
      );
      assert.equal(received?.kind, kind);
      t.mock.restoreAll();
    }
    t.mock.method(
      globalThis,
      'fetch',
      async () =>
        new Response(JSON.stringify({ code: 'OK', message: '成功', data: { wrong: true }, traceId: 'trace' })),
    );
    await assert.rejects(
      request('/inbound', z.object({ saved: z.boolean() })),
      (error: unknown) => error instanceof ApiError && error.kind === 'DATA_INVALID',
    );
  } finally {
    unsubscribe();
  }
});
test('422 只保留位置和安全中文原因', () => {
  assert.equal(new ApiError('第 1 行：重量必须为正十进制 kg', 422, '').message, '第 1 行：重量必须为正十进制 千克');
  const error = new ApiError('Unexpected token', 422, 'trace', {
    fields: [{ path: ['lines', 0, 'weightGrams'], message: 'SQL stack' }],
  });
  assert.equal(error.message, '填写有误，请检查标红的内容');
  assert.deepEqual(error.fields, [{ path: ['lines', 0, 'weightGrams'], message: '请检查此项填写内容' }]);
});
