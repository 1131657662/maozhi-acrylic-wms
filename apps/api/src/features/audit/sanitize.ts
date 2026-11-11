const MAX_DEPTH = 32;
const HIDDEN = '[已隐藏]';
const OMITTED = '[内容超限，已省略]';
const secretKey =
  /password|passwd|pwd|token|secret|credential|authorization|cookie|session.?hash|private.?key|api.?key/i;
const secretText = /(?:bearer\s|(?:password|token|authorization|cookie)["']?\s*[:=]|-----BEGIN .*PRIVATE KEY)/i;

function sanitizeText(text: string, depth: number): string {
  try {
    const parsed: unknown = JSON.parse(text);
    if (parsed !== text && (typeof parsed === 'object' || typeof parsed === 'string'))
      return JSON.stringify(redactAuditValue(parsed, depth + 1));
  } catch {
    /* Plain business text is allowed; malformed secret-bearing text is hidden below. */
  }
  return secretText.test(text) ? HIDDEN : text;
}

export function redactAuditValue(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return OMITTED;
  if (typeof value === 'string') return sanitizeText(value, depth);
  if (value === null || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) {
    return value.map((item) => redactAuditValue(item, depth + 1));
  }
  if (typeof value !== 'object') return null;
  const entries = Object.entries(value).map(([key, item]) => [
    key,
    secretKey.test(key) ? HIDDEN : redactAuditValue(item, depth + 1),
  ]);
  return Object.fromEntries(entries);
}
