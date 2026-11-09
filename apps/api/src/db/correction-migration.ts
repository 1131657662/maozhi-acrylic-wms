import type { Database } from './mysql.ts';

export async function assertCorrectionsReady(db: Database): Promise<void> {
  const row = await db.get("SELECT state FROM schema_migrations WHERE id='011_corrections_business_date'");
  if (row?.state !== 'applied') throw new Error('011 更正与业务日期迁移未完成，拒绝启动写服务');
}
export async function guardCorrectionDown(db: Database): Promise<void> {
  const checks = [
    ['document_corrections', '1=1'],
    ['document_correction_lines', '1=1'],
    ['inbound_receipts', 'business_date IS NOT NULL OR correction_revision<>0'],
    ['outbound_orders', 'business_date IS NOT NULL OR correction_revision<>0'],
    ['stock_journal', 'correction_id IS NOT NULL'],
    ['inventory_operations', "operation_type='stock.correct'"],
    ['document_number_rules', "kind='correction'"],
    ['document_number_counters', "kind='correction'"],
    ['idempotent_commands', "command_key LIKE 'correction.%' OR command_key LIKE 'business-date.%'"],
    ['operation_log', "action='stock.correct' OR action LIKE 'business-date.%'"],
  ];
  for (const [table, where] of checks) {
    if (await db.get(`SELECT 1 FROM ${table} WHERE ${where} LIMIT 1`))
      throw new Error(`拒绝回退：${table} 含有 B5a 数据，禁止删除历史数据`);
  }
}
