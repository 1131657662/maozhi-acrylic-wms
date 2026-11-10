import type { z } from 'zod';

// Translate validation requirements, never echo a rejected value or a schema exception.
export function validationMessage(issue: z.core.$ZodIssue): string {
  if (issue.code === 'too_small') return issue.origin === 'string'
    ? `请至少填写 ${issue.minimum} 个字`
    : issue.origin === 'array' ? `请至少选择 ${issue.minimum} 项` : `数值需${issue.inclusive ? '不小于' : '大于'} ${issue.minimum}`;
  if (issue.code === 'too_big') return issue.origin === 'string'
    ? `最多填写 ${issue.maximum} 个字`
    : issue.origin === 'array' ? `最多选择 ${issue.maximum} 项` : `数值需${issue.inclusive ? '不大于' : '小于'} ${issue.maximum}`;
  if (issue.code === 'invalid_type') return issue.expected === 'number' ? '请填写有效数字' : '请填写或选择此项';
  return '请检查此项填写内容';
}
