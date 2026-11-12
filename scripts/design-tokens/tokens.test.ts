import assert from 'node:assert/strict';
import test from 'node:test';
import { theme } from 'antd';
import { color, createDesignCssText, createDesignCssVariables } from '../../apps/web/src/theme/design-tokens.ts';

test('semantic colors follow the caller theme and do not mutate it', () => {
  const token = theme.getDesignToken({ token: { colorPrimary: '#123456', colorBgLayout: '#abcdef', borderRadius: 8 } });
  const before = structuredClone(token);
  const colors = color(token);
  assert.equal(colors.primary, token.colorPrimary);
  assert.equal(colors.background, token.colorBgLayout);
  assert.equal(colors.border, token.colorBorderSecondary);
  assert.deepEqual(token, before);
});

test('CSS output exposes target lengths and live colors without changing the active radius', () => {
  const token = theme.getDesignToken({ token: { borderRadius: 8, colorPrimary: '#123456' } });
  const variables = createDesignCssVariables(token);
  assert.equal(variables['--wms-radius-card'], '12px');
  assert.equal(variables['--wms-radius-control'], '8px');
  assert.equal(variables['--wms-space-8'], '8px');
  assert.equal(variables['--wms-font-size-page-title'], '20px');
  assert.equal(variables['--wms-font-size-kpi'], '28px');
  assert.equal(variables['--wms-color-primary'], token.colorPrimary);
  assert.equal(token.borderRadius, 8);
  assert.match(createDesignCssText(token), /:root \{\n/);
  assert.match(createDesignCssText(token), /--wms-color-primary: #123456;/);
});
