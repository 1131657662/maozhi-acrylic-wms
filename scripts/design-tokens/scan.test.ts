import assert from 'node:assert/strict';
import test from 'node:test';
import { scanCss } from './scan-css.ts';
import { scanScript } from './scan-script.ts';

for (const value of ['4px', '8px', '16px', '24px', '1rem', '6px 12px', '16vh 5vw', 'calc(100% - 2px)']) {
  test(`padding rejects literal ${value}`, () => {
    const findings = scanCss('page.css', `.page { padding: ${value}; }`);
    assert.deepEqual(
      findings.map(({ kind, value }) => ({ kind, value })),
      [{ kind: 'padding', value }],
    );
  });
}

for (const value of [
  '0',
  '0px',
  '0rem 10%',
  'auto',
  'inherit',
  'unset',
  'var(--wms-space-8)',
  'env(safe-area-inset-bottom)',
]) {
  test(`padding accepts ${value}`, () => {
    assert.deepEqual(scanCss('page.css', `.page { padding: ${value}; }`), []);
  });
}

for (const value of ['0', '4px', '6px', '8px', '12px', '50%']) {
  test(`radius rejects literal ${value}`, () => {
    const findings = scanCss('page.css', `.page { border-radius: ${value}; }`);
    assert.equal(findings[0]?.kind, 'radius');
    assert.equal(findings[0]?.value, value);
  });
}

for (const value of [
  '#123',
  '#1234',
  '#123456',
  '#12345678',
  'rgb(1, 2, 3)',
  'rgba(0,0,0,.04)',
  'white',
  'rebeccapurple',
  'transparent',
]) {
  test(`color rejects literal ${value}`, () => {
    const findings = scanCss('page.css', `.page { color: ${value}; }`);
    assert.equal(findings[0]?.kind, 'color');
    assert.equal(findings[0]?.value, value);
  });
}

test('CSS variables pass while literal fallbacks and mixed padding fail', () => {
  const findings = scanCss(
    'page.css',
    `.page {
    border-radius: var(--wms-radius-card); color: var(--wms-color-text);
    padding: var(--wms-space-8) 16px; border-color: var(--border, #123);
    padding-inline: var(--wms-space-8, 4px); border-start-end-radius: 6px;
  }`,
  );
  assert.deepEqual(
    findings.map(({ kind }) => kind),
    ['padding', 'color', 'padding', 'radius'],
  );
});

test('CSS comments, quoted content and URLs do not report colors', () => {
  const source = '/* color: red; padding: 8px */ .page { content: "white"; background: url("/red.svg#abc"); }';
  assert.deepEqual(scanCss('page.css', source), []);
});

test('TSX catches numeric styles, quoted keys, logical properties and palette branches', () => {
  const source = `const view = <Tag color={active ? 'blue' : 'success'} style={{
    padding: 8, paddingInline: '6px 12px', 'border-radius': 0, borderStartStartRadius: 12,
    color: '#123', background: 'rgb(1,2,3)',
  }} />;`;
  const findings = scanScript('page.tsx', source);
  assert.deepEqual(
    findings.map(({ kind }) => kind),
    ['color', 'padding', 'padding', 'radius', 'radius', 'color', 'color'],
  );
  assert.equal(findings[1]?.line, 2);
});

test('TSX token references, zero padding, percentage and semantic statuses pass', () => {
  const source = `const view = <Tag color={active ? 'warning' : 'default'} style={{
    padding: token.padding, paddingInline: '0 10%', paddingBlock: 'var(--wms-space-8)',
    borderRadius: radius.card, color: token.colorText, background: 'var(--wms-color-surface)',
  }} />; // color: '#123', padding: 8`;
  assert.deepEqual(scanScript('page.tsx', source), []);
});

test('conditional numeric branches and template literal lengths cannot bypass padding checks', () => {
  const source = 'const style = { padding: wide ? 8 : token.padding, paddingInline: `${token.padding}px 4px` };';
  const findings = scanScript('page.ts', source);
  assert.equal(findings.length, 2);
  assert.ok(findings.every((finding) => finding.kind === 'padding'));
});

test('direct style assignment and setProperty cannot bypass literal dimension checks', () => {
  const source = "style.padding = '8px'; style['borderRadius'] = '50%'; style.setProperty('padding-inline', '1rem');";
  const findings = scanScript('page.ts', source);
  assert.deepEqual(
    findings.map(({ kind }) => kind),
    ['padding', 'radius', 'padding'],
  );
});

test('malformed CSS and TSX fail instead of silently disappearing', () => {
  assert.throws(() => scanCss('page.css', '.page { padding: 8px;'), /Unclosed/);
  assert.throws(() => scanScript('page.tsx', 'const x = <div style={{ padding: }} />;'));
});
