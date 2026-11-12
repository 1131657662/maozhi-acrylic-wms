import type { GlobalToken } from 'antd';

// Target values for B6j-2. Importing this module never changes the active theme.
export const radius = { card: 12, control: 8 } as const;
export const spacing = { 4: 4, 8: 8, 16: 16, 24: 24 } as const;
export const fontSize = { pageTitle: 20, cardTitle: 16, body: 14, auxiliary: 12, kpi: 28 } as const;
export const lineHeight = { pageTitle: 28, cardTitle: 24, body: 22, auxiliary: 20, kpi: 36 } as const;
export const fontWeight = { regular: 400, semibold: 600 } as const;
export const componentSize = { compactEmpty: 120 } as const;
export type StatusTone = 'default' | 'processing' | 'success' | 'warning' | 'error';

export function statusColors(token: GlobalToken) {
  return {
    default: { color: token.colorText, background: token.colorFillAlter, borderColor: token.colorBorder },
    processing: { color: token.colorPrimary, background: token.colorPrimaryBg, borderColor: token.colorPrimaryBorder },
    success: { color: token.colorSuccess, background: token.colorSuccessBg, borderColor: token.colorSuccessBorder },
    warning: { color: token.colorWarning, background: token.colorWarningBg, borderColor: token.colorWarningBorder },
    error: { color: token.colorError, background: token.colorErrorBg, borderColor: token.colorErrorBorder },
  };
}

type ColorName =
  | 'primary'
  | 'success'
  | 'warning'
  | 'error'
  | 'border'
  | 'text'
  | 'textSecondary'
  | 'background'
  | 'surface'
  | 'textOnSolid';
export type DesignColors = Readonly<Record<ColorName, string>>;
export type DesignCssVariables = Record<`--wms-${string}`, string>;

export function color(token: GlobalToken): DesignColors {
  return {
    primary: token.colorPrimary,
    success: token.colorSuccess,
    warning: token.colorWarning,
    error: token.colorError,
    border: token.colorBorderSecondary,
    text: token.colorText,
    textSecondary: token.colorTextSecondary,
    background: token.colorBgLayout,
    surface: token.colorBgContainer,
    textOnSolid: token.colorTextLightSolid,
  };
}

export function createDesignCssVariables(token: GlobalToken): DesignCssVariables {
  const variables: DesignCssVariables = {};
  const groups = [
    { name: 'radius', values: radius, unit: 'px' },
    { name: 'space', values: spacing, unit: 'px' },
    { name: 'font-size', values: fontSize, unit: 'px' },
    { name: 'line-height', values: lineHeight, unit: 'px' },
    { name: 'font-weight', values: fontWeight, unit: '' },
  ];
  for (const { name: group, values, unit } of groups) {
    for (const [name, value] of Object.entries(values)) {
      const suffix = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      variables[`--wms-${group}-${suffix}`] = `${value}${unit}`;
    }
  }
  variables['--wms-size-compact-empty'] = `${componentSize.compactEmpty}px`;
  for (const [name, value] of Object.entries(color(token))) {
    const suffix = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
    variables[`--wms-color-${suffix}`] = value;
  }
  return variables;
}

export function createDesignCssText(token: GlobalToken): string {
  const declarations = Object.entries(createDesignCssVariables(token)).map(([name, value]) => `  ${name}: ${value};`);
  return `:root {\n${declarations.join('\n')}\n}\n`;
}
