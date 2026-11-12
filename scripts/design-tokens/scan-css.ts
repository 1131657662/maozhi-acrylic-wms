import postcss from 'postcss';
import { dimensionKind, hasRawDimension, rawColors } from './values.ts';
import type { Finding } from './types.ts';

export function scanCss(file: string, source: string): Finding[] {
  const findings: Finding[] = [];
  const root = postcss.parse(source, { from: file });
  root.walkDecls((declaration) => {
    const position = declaration.source?.start;
    const location = { file, line: position?.line ?? 1, column: position?.column ?? 1 };
    for (const match of rawColors(declaration.value)) {
      findings.push({ ...location, kind: 'color', value: match.value });
    }
    const kind = dimensionKind(declaration.prop);
    if (kind && hasRawDimension(declaration.value, kind)) {
      findings.push({ ...location, kind, value: declaration.value });
    }
  });
  return findings;
}
