import test from 'node:test';
import assert from 'node:assert/strict';
import { webOutboundQuerySchema } from '@wms/contracts';
import { internalDestination, listDestination } from '../../web/src/features/outbound/list-route.ts';

test('B7b legacy list keys preserve exact query/hash; bare root is workbench', () => {
  for (const key of Object.keys(webOutboundQuerySchema.shape)) {
    const suffix = `?${key}=x&keyword=%E8%85%88%E7%BA%B6&keyword=a+b#rows`;
    assert.equal(internalDestination('/' + suffix), '/outbound' + suffix);
  }
  assert.equal(internalDestination('/'), '/');
  assert.equal(internalDestination('/?welcome=1'), '/?welcome=1');
  assert.equal(internalDestination('/outbound/new'), '/outbound/new');
});
test('B7b safe login redirects and listReturn migration', () => {
  for (const value of [
    'https://outside.invalid',
    '//outside.invalid',
    '/\\outside.invalid',
    '/\n/outside.invalid',
    '/user/login',
  ])
    assert.equal(internalDestination(value), '/');
  assert.equal(listDestination('/?status=open&page=2#rows', '/outbound'), '/outbound?status=open&page=2#rows');
  assert.equal(listDestination('/', '/outbound'), '/outbound');
  assert.equal(listDestination('/inbound?keyword=a', '/outbound'), '/outbound');
  assert.equal(listDestination('/inbound?page=2', '/inbound'), '/inbound?page=2');
});
