import { createHash } from 'node:crypto';

export type JsonSchema = boolean | Record<string, unknown>;
export type OpenApiPaths = Record<string, Record<string, unknown>>;
export interface SchemaReference {
  $ref: string;
}

const schemaKeywords = new Set([
  'additionalProperties',
  'contains',
  'contentSchema',
  'else',
  'if',
  'items',
  'not',
  'propertyNames',
  'then',
  'unevaluatedItems',
  'unevaluatedProperties',
]);
const schemaMapKeywords = new Set(['$defs', 'definitions', 'dependentSchemas', 'patternProperties', 'properties']);
const schemaArrayKeywords = new Set(['allOf', 'anyOf', 'oneOf', 'prefixItems']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isSchema(value: unknown): value is JsonSchema {
  return typeof value === 'boolean' || isObject(value);
}

function forEachChildSchema(schema: JsonSchema, visit: (child: JsonSchema) => void): void {
  if (typeof schema === 'boolean') return;
  for (const [key, value] of Object.entries(schema)) {
    if (schemaKeywords.has(key) && isSchema(value)) visit(value);
    else if ((schemaMapKeywords.has(key) || schemaArrayKeywords.has(key)) && Array.isArray(value)) {
      for (const child of value) if (isSchema(child)) visit(child);
    } else if (schemaMapKeywords.has(key) && isObject(value)) {
      for (const child of Object.values(value)) if (isSchema(child)) visit(child);
    }
  }
}

function countSchema(schema: JsonSchema, counts: Map<string, number>): void {
  const key = JSON.stringify(schema);
  counts.set(key, (counts.get(key) ?? 0) + 1);
  forEachChildSchema(schema, (child) => countSchema(child, counts));
}

function walkDocument(value: unknown, visit: (schema: JsonSchema) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walkDocument(item, visit);
  } else if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'schema' && isSchema(child)) visit(child);
      else walkDocument(child, visit);
    }
  }
}

function mapChild(value: unknown, reference: (schema: JsonSchema) => unknown): unknown {
  return isSchema(value) ? reference(value) : value;
}

function mapSchemaChildren(schema: JsonSchema, reference: (schema: JsonSchema) => unknown): JsonSchema {
  if (typeof schema === 'boolean') return schema;
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (schemaKeywords.has(key)) result[key] = mapChild(value, reference);
    else if (schemaMapKeywords.has(key) && isObject(value))
      result[key] = Object.fromEntries(Object.entries(value).map(([name, child]) => [name, mapChild(child, reference)]));
    else if (schemaArrayKeywords.has(key) && Array.isArray(value))
      result[key] = value.map((child) => mapChild(child, reference));
    else result[key] = value;
  }
  return result;
}

function mapDocument(value: unknown, reference: (schema: JsonSchema) => unknown): unknown {
  if (Array.isArray(value)) return value.map((item) => mapDocument(item, reference));
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.entries(value).map(([key, child]) => [
      key,
      key === 'schema' && isSchema(child) ? reference(child) : mapDocument(child, reference),
    ]),
  );
}

export function shareSchemas(paths: OpenApiPaths): {
  paths: OpenApiPaths;
  schemas: Record<string, JsonSchema>;
} {
  const counts = new Map<string, number>();
  walkDocument(paths, (schema) => countSchema(schema, counts));
  const schemas: Record<string, JsonSchema> = {};
  const namesByContent = new Map<string, string>();

  function reference(input: JsonSchema): unknown {
    const rawContent = JSON.stringify(input);
    const schema = mapSchemaChildren(input, reference);
    if (typeof input === 'boolean' || (counts.get(rawContent) ?? 0) < 2) return schema;
    const content = JSON.stringify(schema);
    const existing = namesByContent.get(content);
    if (existing) return { $ref: `#/components/schemas/${existing}` };
    const name = `S_${createHash('sha256').update(content).digest('hex').slice(0, 16)}`;
    if (Object.hasOwn(schemas, name)) throw new Error(`OpenAPI schema name collision: ${name}`);
    schemas[name] = schema;
    namesByContent.set(content, name);
    return { $ref: `#/components/schemas/${name}` };
  }

  return { paths: mapDocument(paths, reference) as OpenApiPaths, schemas };
}
