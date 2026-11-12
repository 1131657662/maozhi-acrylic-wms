import valueParser from 'postcss-value-parser';
import { colorNames } from './color-names.ts';
import type { FindingKind } from './types.ts';

export function dimensionKind(property: string): Exclude<FindingKind, 'color'> | undefined {
  const name = property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`).toLowerCase();
  if (/^padding(?:-(?:top|right|bottom|left|block|inline)(?:-(?:start|end))?)?$/.test(name)) return 'padding';
  if (/^border-(?:(?:top|bottom)-(?:left|right)-|(?:start|end)-(?:start|end)-)?radius$/.test(name)) return 'radius';
  return undefined;
}

export function rawColors(value: string): { value: string; offset: number }[] {
  const matches: { value: string; offset: number }[] = [];
  valueParser(value).walk((node) => {
    if (node.type === 'function' && node.value.toLowerCase() === 'url') return false;
    if (node.type === 'function' && /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)$/i.test(node.value)) {
      matches.push({ value: valueParser.stringify(node), offset: node.sourceIndex });
      return false;
    }
    if (node.type !== 'word') return;
    if (/^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/i.test(node.value) || colorNames.has(node.value.toLowerCase())) {
      matches.push({ value: node.value, offset: node.sourceIndex });
    }
  });
  return matches;
}

export function hasRawDimension(value: string, kind: 'radius' | 'padding'): boolean {
  let found = false;
  valueParser(value).walk((node) => {
    if (node.type === 'function' && node.value.toLowerCase() === 'url') return false;
    if (node.type !== 'word') return;
    const dimension = valueParser.unit(node.value);
    if (!dimension) return;
    if (kind === 'padding' && (Number(dimension.number) === 0 || dimension.unit === '%')) return;
    found = true;
  });
  return found;
}
