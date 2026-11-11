import { ZodError } from 'zod';
import { AppError } from '../../shared/errors.ts';
import type { AttemptContext } from './context.ts';

const reasons: Record<string, string> = {
  INVALID_CREDENTIALS: '用户名或密码不正确',
  UNAUTHORIZED: '登录已失效，请重新登录',
  CLIENT_NOT_ALLOWED: '当前客户端不能进行此操作',
  ORIGIN_NOT_ALLOWED: '请求来源不允许',
  IDEMPOTENCY_CONFLICT: '此次操作内容已变化，请重新打开后提交',
  DOWNSTREAM_DEPENDENCY: '存在后续库存动作，不能自动撤销',
  STOCK_EVIDENCE_MISMATCH: '当前库存与原确认后的记录不一致，请核实台账',
  INVALID_TRANSITION: '单据状态已变化，不能进行此操作',
  ALREADY_CONFIRMED: '单据已确认或不处于待确认状态',
  INSUFFICIENT_STOCK: '库存不足，请核对包数和吨数',
  RATE_LIMITED: '操作过于频繁，请稍后重试',
  EXPORT_CANCELLED: '导出已取消，未提供部分文件',
};
export function failureEvidence(error: unknown, context: AttemptContext) {
  const unknown = context.phase === 'unknown' || context.phase === 'started' || context.committed;
  const invalid = error instanceof ZodError || error instanceof SyntaxError;
  const code = error instanceof AppError ? error.code : invalid ? 'VALIDATION_ERROR' : 'INTERNAL_ERROR';
  return {
    result: unknown ? 'unknown' : code === 'EXPORT_CANCELLED' ? 'cancelled' : 'failed',
    effectState: unknown ? 'unknown' : 'not_applied',
    code: unknown ? 'TRANSACTION_OUTCOME_UNKNOWN' : code,
    reason: unknown
      ? '处理结果待核实，请先查看单据状态'
      : invalid
        ? '填写内容或格式不正确'
        : (reasons[code] ??
          (error instanceof AppError && error.status === 409
            ? '单据或库存状态已变化，请刷新核对后重试'
            : error instanceof AppError && error.status === 422
              ? '填写内容不符合要求，请检查后重试'
              : '操作未完成，请重试或联系维护人员')),
  };
}
