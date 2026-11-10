export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public status = 409,
    public data: Record<string, unknown> | null = null,
  ) {
    super(message);
  }
}

export function ensure(condition: unknown, code: string, message: string): asserts condition {
  if (!condition) throw new AppError(code, message);
}
