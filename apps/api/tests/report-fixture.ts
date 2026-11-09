import { fixture } from './fixture.ts';
import { seedReportEvidence } from '../../../scripts/report-fixtures.ts';
import { login } from '../src/features/auth/service.ts';
import { webExports } from '../src/features/web-exports/service.ts';
import { seedB3cFixtures } from '../../../scripts/report-derived-fixtures.ts';

export const reportParams = {
  source: 'erp-product',
  fromDay: '2026-01-01',
  toDay: '2026-03-31',
  product: 'RPT-P',
  direction: 'asc',
  pageSize: '200',
};
export async function reportFixture() {
  const f = await fixture();
  await seedReportEvidence(f.db);
  const session = await login(
    f.db,
    { username: 'owner', password: 'test-only-password', channel: 'web' },
    { username: 'owner', traceId: 'report-test' },
  );
  return { ...f, cookie: `wms_session=${session.token}`, service: await webExports(f.db) };
}
export async function derivedReportFixture() {
  const f = await reportFixture();
  await seedB3cFixtures(f.db);
  return f;
}
