import type { Response } from 'express';

export function legacyNumberHeaders(res: Response, number: string | undefined): void {
  if (number === undefined) return;
  res.set('Deprecation', '@1794096000');
  res.set('X-Document-Number-Mode', 'legacy-preserved');
}
