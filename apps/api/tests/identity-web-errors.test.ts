import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_TEXT } from '@wms/contracts';
import { ApiError } from '../../web/src/api/errors.ts';

test('B8b Web仅展示固定认证文案及校验后的锁定剩余秒数', () => {
  const error = (message: string, status: number, path: string, data?: unknown) =>
    new ApiError(message, status, '', data, undefined, path).message;
  assert.equal(error(AUTH_TEXT.invalidCredentials, 401, '/auth/login'), AUTH_TEXT.invalidCredentials);
  assert.match(error(AUTH_TEXT.locked, 429, '/auth/login', { retryAfterSeconds: 900 }), /900 秒/);
  assert.equal(error(AUTH_TEXT.locked, 429, '/auth/login', { retryAfterSeconds: 'secret' }), AUTH_TEXT.locked);
  for (const text of [AUTH_TEXT.passwordRule, AUTH_TEXT.passwordTooLong, AUTH_TEXT.oldPassword])
    assert.equal(error(text, 422, '/me/password'), text);
  assert.doesNotMatch(error('SQL password=secret', 422, '/me/password'), /secret|SQL/);
  assert.notEqual(error(AUTH_TEXT.invalidCredentials, 401, '/stock'), AUTH_TEXT.invalidCredentials);
});
