import { randomUUID } from 'node:crypto';
import {
  listFields,
  listPreferencesInputSchema,
  listPreferencesSchema,
  WEB_LIST_VIEW_SCHEMA_VERSION,
  type ExportKind,
  type ListPreferencesInput,
  type ListPreferenceColumns,
} from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';

function knownColumns(kind: ExportKind, columns: ListPreferenceColumns): ListPreferenceColumns {
  const keys = new Set([...listFields[kind].map((field) => field.key), 'action', 'matchedSummary']);
  return Object.fromEntries(Object.entries(columns).filter(([key]) => keys.has(key)));
}
export async function readPreferences(db: Database, user: string, kind: ExportKind) {
  const row = await db.get(
    'SELECT schema_version,payload,updated_at FROM user_list_preferences WHERE user_id=? AND list_kind=?',
    [user, kind],
  );
  const input = row
    ? listPreferencesInputSchema.parse({
        schemaVersion: Number(row.schema_version),
        columns: typeof row.payload === 'string' ? JSON.parse(row.payload) : row.payload,
      })
    : { columns: {} };
  return listPreferencesSchema.parse({
    schemaVersion: WEB_LIST_VIEW_SCHEMA_VERSION,
    columns: knownColumns(kind, input.columns),
    updatedAt: row ? String(row.updated_at) : null,
  });
}
export async function savePreferences(
  db: Database,
  options: { user: string; kind: ExportKind; input: ListPreferencesInput },
) {
  const columns = knownColumns(options.kind, options.input.columns);
  // One atomic upsert per identity/list. Empty payload is a reset marker, not deletion of user history.
  await db.run(
    `INSERT INTO user_list_preferences(id,user_id,list_kind,schema_version,payload,updated_at)
    VALUES(?,?,?,?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE
    schema_version=VALUES(schema_version),payload=VALUES(payload),updated_at=UTC_TIMESTAMP(3)`,
    [randomUUID(), options.user, options.kind, WEB_LIST_VIEW_SCHEMA_VERSION, JSON.stringify(columns)],
  );
  return readPreferences(db, options.user, options.kind);
}
