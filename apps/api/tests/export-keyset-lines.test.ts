import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import {
  listCellText,
  matchedLineFields,
  webInboundQuerySchema,
  webOutboundQuerySchema,
  type ExportRequest,
} from '@wms/contracts';
import { exportFixture, waitExport, workbook } from './export-fixture.ts';
import { actor } from './fixture.ts';
import { listWebInbound } from '../src/features/web-lists/inbound.ts';
import { listWebOutbound } from '../src/features/web-lists/outbound.ts';
import { rowToken } from '../src/features/web-lists/query.ts';
import { installProbe, measurement, probe } from '../../../scripts/b6b/probe.ts';

const digest = (rows: unknown[]) => createHash('sha256').update(JSON.stringify(rows)).digest('hex');
for (const kind of ['inbound', 'outbound'] as const)
  test(`B6i-1 ${kind}: matched-line row counts and ordered field hashes match list baseline in every scope`, async () => {
    const f = await exportFixture(40);
    const restore = installProbe();
    try {
      const query = {
        productCodes: Array.from({ length: 40 }, (_, i) => 'WL-P' + String(i).padStart(6, '0')).join(','),
        sortBy: kind === 'inbound' ? 'receiptNo' : 'orderNo',
        direction: 'desc',
        pageSize: '20',
        page: '2',
      };
      const all =
        kind === 'inbound'
          ? await listWebInbound(f.db, { ...webInboundQuerySchema.parse(query), page: 1, pageSize: 200 })
          : await listWebOutbound(f.db, { ...webOutboundQuerySchema.parse(query), page: 1, pageSize: 200 });
      const displayed = await f.api.get(`/api/v1/web/lists/${kind}`).query(query).set('Cookie', f.cookie).expect(200);
      const fields = matchedLineFields(kind);
      for (const scope of ['all', 'page', 'selected'] as const) {
        const documents =
          scope === 'all' ? all.items : scope === 'page' ? all.items.slice(20) : [all.items[0]!, all.items[39]!];
        const expected = documents.flatMap((doc) =>
          (doc.matchedLines ?? []).map((line) => {
            const row = { ...line, [query.sortBy]: doc[query.sortBy as keyof typeof doc] };
            return fields.map((field) =>
              field.type === 'integer'
                ? Number(row[field.key as keyof typeof row])
                : field.type === 'tonnes'
                  ? Number(row[field.key as keyof typeof row]) / 1_000_000
                  : listCellText(kind, field, row),
            );
          }),
        );
        const input: ExportRequest = {
          kind,
          query,
          scope,
          schema: 'matched_lines',
          format: 'xlsx',
          requestId: randomUUID(),
          columns: fields.map((field) => field.key),
          viewToken: displayed.body.data.viewToken,
          selected: scope === 'selected' ? documents.map((doc) => ({ id: doc.id, token: rowToken(doc) })) : [],
        };
        const sql = measurement();
        const end = await probe.run(sql, async () => {
          const job = await f.service.create(input, actor);
          return waitExport(f, job.id);
        });
        assert.equal(end.state, 'ready', end.error ?? '');
        assert.equal(end.processed, expected.length);
        const { sheet } = await workbook(f, end.id);
        assert.deepEqual(
          fields.map((_, i) => sheet.getCell(1, i + 1).value),
          fields.map((field) => field.label),
        );
        const actual = expected.map((_, i) => fields.map((_, column) => sheet.getCell(i + 2, column + 1).value));
        assert.equal(digest(actual), digest(expected));
        assert.equal(
          sql.queries.some((q) => /\bOFFSET\b/i.test(q.sql)),
          false,
        );
      }
    } finally {
      restore();
      await f.dispose();
    }
  });
