import { randomUUID } from 'node:crypto';
import { e2eDatabase } from './inventory-helpers';

export async function auditPageFixture() {
  const db = e2eDatabase(),
    trace = randomUUID(),
    marker = `页面验收-${randomUUID().slice(0, 8)}`;
  try {
    for (const [index, result] of ['success', 'cancelled', 'unknown', null].entries()) {
      await db.run(
        `INSERT INTO operation_log(action,target_kind,target_id,target_no,actor,trace_id,created_at,
        channel,result,effect_state,summary,before_json,after_json)
        VALUES(?,?,?,?,?,?,UTC_TIMESTAMP(3),?,?,?,?,?,?)`,
        [
          index === 1 ? 'catalog.publish' : 'inbound.confirm',
          index === 1 ? 'catalog' : 'inbound',
          `deleted-${trace}-${index}`,
          `RK-页面验收-${index + 1}`,
          marker,
          trace,
          result ? 'web' : null,
          result,
          result === 'success'
            ? 'applied'
            : result === 'unknown'
              ? 'unknown'
              : result === 'cancelled'
                ? 'not_applied'
                : null,
          result === 'success'
            ? '状态 待确认→已入账'
            : result === 'cancelled'
              ? '本次操作已取消'
              : result === 'unknown'
                ? '操作结果尚待核实'
                : '历史操作结果未记录',
          JSON.stringify({ packages: 1 }),
          JSON.stringify({ packages: 2, credential: 'SECRET-CREDENTIAL' }),
        ],
      );
    }
    const attempt = randomUUID();
    await db.run(
      `INSERT INTO operation_attempts(attempt_id,actor,channel,action,target_kind,target_id,target_no,
      result,effect_state,error_code,failure_reason,trace_id,occurred_at,input_summary)
      VALUES(?,?,'web','inbound.confirm','inbound',?,'RK-页面验收-1','failed','not_applied','TEST_FAILURE',
      '填写内容或格式不正确',?,UTC_TIMESTAMP(3),?)`,
      [
        attempt,
        marker,
        `deleted-${trace}-0`,
        trace,
        JSON.stringify({ data: { token: 'SECRET-TOKEN', safe: '业务资料' } }),
      ],
    );
    return { marker, trace, attempt: `attempt:${attempt}` };
  } finally {
    await db.close();
  }
}
