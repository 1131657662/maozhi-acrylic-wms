import assert from 'node:assert/strict';
import test from 'node:test';
import { shareSchemas } from '../src/openapi-schemas.ts';

test('重复嵌套 schema 共享组件且唯一 schema 保持内联顺序', () => {
  const repeated = () => ({
    type: 'object',
    properties: { code: { type: 'string', minLength: 1 } },
    required: ['code'],
    additionalProperties: false,
  });
  const paths = {
    '/first': { get: { responses: { 200: { content: { 'application/json': { schema: repeated() } } } } } },
    '/second': { post: { requestBody: { content: { 'application/json': { schema: repeated() } } } } },
    '/unique': {
      get: { responses: { 200: { content: { 'application/json': { schema: { type: 'integer', minimum: 1 } } } } } },
    },
  };

  const result = shareSchemas(paths);
  const first = result.paths['/first']!.get as { responses: { 200: { content: { 'application/json': { schema: unknown } } } } };
  const second = result.paths['/second']!.post as { requestBody: { content: { 'application/json': { schema: unknown } } } };
  const firstRef = first.responses[200].content['application/json'].schema as { $ref: string };
  const secondRef = second.requestBody.content['application/json'].schema as { $ref: string };
  assert.deepEqual(firstRef, secondRef);
  assert.equal(Object.keys(result.schemas).length, 2);

  const parent = result.schemas[firstRef.$ref.split('/').at(-1)!] as Record<string, unknown>;
  assert.deepEqual(Object.keys(parent), ['type', 'properties', 'required', 'additionalProperties']);
  assert.deepEqual(parent.properties, { code: { $ref: Object.keys(result.schemas).map((name) => `#/components/schemas/${name}`).find((ref) => ref !== firstRef.$ref) } });
  assert.deepEqual(parent.required, ['code']);
  assert.equal(parent.additionalProperties, false);

  const unique = result.paths['/unique']!.get as {
    responses: { 200: { content: { 'application/json': { schema: unknown } } } };
  };
  assert.deepEqual(unique.responses[200].content['application/json'].schema, { type: 'integer', minimum: 1 });
});
