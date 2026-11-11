import { randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import ExcelJS from 'exceljs';
import { exportJobSchema, type ExportRequest, type WebListKind } from '@wms/contracts';
import { fixture } from './fixture.ts';
import { seedListEvidence } from '../../../scripts/e2e-list-fixtures.ts';
import { login } from '../src/features/auth/service.ts';
import { webExports } from '../src/features/web-exports/service.ts';

export const exportQueries: Record<WebListKind, Record<string, string>> = {
  inbound: { keyword: 'WL-RK-', sortBy: 'receiptNo', direction: 'asc' },
  outbound: { keyword: 'WL-CK-', sortBy: 'orderNo', direction: 'asc' },
  stock: { source: 'erp-product', product: 'WL-P', sortBy: 'productCode', direction: 'asc' },
  audit: { action: 'list.fixture', sortBy: 'id', direction: 'asc' },
};
export async function exportFixture(count = 240) {
  const f = await fixture();
  await seedListEvidence(f.db, count);
  const session = await login(
    f.db,
    { username: 'owner', password: 'test-only-password', channel: 'web' },
    { username: 'owner', traceId: 'export-test' },
  );
  const cookie = `wms_session=${session.token}`;
  const service = await webExports(f.db);
  return { ...f, service, cookie };
}
export async function exportInput(
  f: Awaited<ReturnType<typeof exportFixture>>,
  kind: WebListKind,
  scope: ExportRequest['scope'] = 'all',
) {
  const query = { ...exportQueries[kind], page: '2', pageSize: '20' };
  const response = await f.api.get(`/api/v1/web/lists/${kind}`).query(query).set('Cookie', f.cookie).expect(200);
  const columns: Record<WebListKind, string[]> = {
    inbound: ['receiptNo', 'packages', 'weightGrams', 'createdAt', 'status'],
    outbound: [
      'orderNo',
      'customerName',
      'plannedPackages',
      'plannedWeightGrams',
      'actualPackages',
      'actualWeightGrams',
      'createdAt',
      'status',
    ],
    stock: ['productName', 'productCode', 'packages', 'weightGrams', 'warehouseCode'],
    audit: ['action', 'objectLabel', 'actor', 'createdAt'],
  };
  const input: ExportRequest = {
    requestId: randomUUID(),
    kind,
    scope,
    query,
    columns: columns[kind],
    viewToken: response.body.data.viewToken,
    selected: [],
  };
  return { input, page: response.body.data };
}
export async function waitExport(f: Awaited<ReturnType<typeof exportFixture>>, id: string) {
  for (let i = 0; i < 1000; i++) {
    const job = exportJobSchema.parse(await f.service.get(id));
    if (job.state !== 'running' && !(await f.service.current())) return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Export test timed out');
}
export async function workbook(f: Awaited<ReturnType<typeof exportFixture>>, id: string) {
  const file = await f.service.download(id);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file.path);
  return { book, sheet: book.worksheets[0]!, file };
}
export async function evidence(name: string, value: unknown): Promise<void> {
  await mkdir('.local/evidence', { recursive: true });
  console.log(name, JSON.stringify(value));
}
