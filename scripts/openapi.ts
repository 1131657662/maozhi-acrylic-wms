import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openApiDocument, operations } from '../apps/api/src/openapi.ts';

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => [key, ordered(entry)]),
  );
}

const target = fileURLToPath(new URL('../docs/api/', import.meta.url));
mkdirSync(target, { recursive: true });
writeFileSync(`${target}/openapi.json`, JSON.stringify(ordered(openApiDocument()), null, 2) + '\n');
const rows = operations.map(
  (operation) =>
    `| ${operation.method.toUpperCase()} | /api/v1${operation.path} | ${operation.channel ?? '公开'} | ${operation.summary} |`,
);
writeFileSync(
  `${target}/ENDPOINTS.md`,
  [
    '# API 清单（由后端共享校验契约生成）',
    '',
    '执行 `npm run openapi` 重新生成；完整输入/输出 schema 见 openapi.json。',
    '',
    '| 方法 | 路径 | 客户端 | 说明 |',
    '|---|---|---|---|',
    ...rows,
    '',
    '统一响应 `{ code, message, data, traceId }`；重量整数克，吨数展示除以 1,000,000，保留四位小数。',
    'Web 确认要求 Cookie + 允许的 Origin，PDA 与小程序 Bearer 会话不能确认库存。',
    '列表参数 page/pageSize/status/keyword；结果 data.items/total/page/pageSize。详情含 lines/facts/digest。',
  ].join('\n'),
);
console.log('已生成 docs/api/openapi.json 与 ENDPOINTS.md');
