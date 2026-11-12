import type { GlobalToken } from 'antd';

// Target values for B6j-2. Importing this module never changes the active theme.
export const radius = { card: 12, control: 8 } as const;
export const spacing = { 4: 4, 8: 8, 16: 16, 24: 24 } as const;
export const fontSize = { pageTitle: 20, cardTitle: 16, body: 14, auxiliary: 12, kpi: 28 } as const;

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
  const groups = { radius, space: spacing, 'font-size': fontSize };
  for (const [group, values] of Object.entries(groups)) {
    for (const [name, value] of Object.entries(values)) {
      const suffix = name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
      variables[`--wms-${group}-${suffix}`] = `${value}px`;
    }
  }
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
