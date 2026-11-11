import { z } from 'zod';
import { businessErrorText, listTime } from '@wms/contracts';
import { errorCopy, errorUi } from '../text';

export type ErrorKind = keyof typeof errorCopy;
const fieldsSchema = z.object({
  fields: z.array(z.object({ path: z.array(z.union([z.string(), z.number()])), message: z.string() })).optional(),
});
export function errorKind(status: number): ErrorKind {
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT_FOUND';
  if (status === 409) return 'CONFLICT';
  if (status === 408 || status === 504) return 'TIMEOUT';
  if ([502, 503].includes(status)) return 'UNAVAILABLE';
  if (status >= 500) return 'SERVER';
  return 'VALIDATION';
}
export function safeBusinessMessage(message: string, fallback: string): string {
  message = message.replace(/\bkg\b/g, errorUi.kilograms);
  // Never display exception text, embedded identifiers or a server stack.
  return message.length <= 240 && /^[\p{Script=Han}\d\s，。；：、！？（）《》【】“”‘’.,:+\-/%]+$/u.test(message)
    ? businessErrorText(message)
    : fallback;
}
export class ApiError extends Error {
  readonly time = listTime(new Date().toISOString());
  readonly fields: { path: (string | number)[]; message: string }[];
  constructor(
    message: string,
    public status: number,
    public traceId: string,
    public data?: unknown,
    public kind: ErrorKind = errorKind(status),
    public path = '',
  ) {
    const fallback = errorCopy[kind][0];
    const detail = kind === 'VALIDATION' || (kind === 'CONFLICT' && /^库存(?:不足|包数或实重不足)/.test(message));
    super(detail ? safeBusinessMessage(message, fallback) : fallback);
    this.name = 'ApiError';
    const parsed = fieldsSchema.safeParse(data);
    this.fields = (parsed.success ? (parsed.data.fields ?? []) : []).map((field) => ({
      path: field.path,
      message: safeBusinessMessage(field.message, errorUi.invalid),
    }));
  }
}
export function friendlyError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof z.ZodError)
    return new ApiError('', 422, '', {
      fields: error.issues.map((issue) => ({ path: issue.path, message: errorUi.invalid })),
    });
  if (error instanceof Error && safeBusinessMessage(error.message, '') !== '')
    return new ApiError(error.message, 422, '');
  return new ApiError('', 0, '', undefined, 'DATA_INVALID');
}
export const errorMessage = (error: unknown) => friendlyError(error).message;
export function diagnosticPath(path: string): string {
  return path
    .split('?')[0]!
    .split('/')
    .map((segment) => (/^[a-z][a-z-]*$/.test(segment) || !segment ? segment : ':record'))
    .join('/');
}
