// Compare SQL formatting without changing quoted values or line-comment boundaries.
// Windows mysqldump can expand CRLF in stored trigger bodies to CRCRLF.
export function normalizeSqlStructure(sql: string): string {
  return sql
    .replace(
      /'(?:\\[\s\S]|''|[^'\\])*'|"(?:\\[\s\S]|""|[^"\\])*"|`(?:``|[^`])*`|--(?=\s)[^\r\n]*(?:\r?\n|$)|#[^\r\n]*(?:\r?\n|$)|\/\*[\s\S]*?\*\/|\s+/g,
      (token) => (/^\s/.test(token) ? ' ' : token),
    )
    .trim();
}
