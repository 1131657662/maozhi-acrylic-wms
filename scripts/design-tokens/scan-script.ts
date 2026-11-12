import ts from 'typescript';
import { dimensionKind, hasRawDimension, rawColors } from './values.ts';
import type { Finding } from './types.ts';

function propertyName(node: ts.PropertyName | ts.JsxAttributeName): string | undefined {
  if (ts.isIdentifier(node) || ts.isStringLiteralLike(node)) return node.text;
  if (ts.isComputedPropertyName(node) && ts.isStringLiteralLike(node.expression)) return node.expression.text;
  return undefined;
}

function dimensionLiterals(node: ts.Node): { node: ts.Node; value: string }[] {
  if (ts.isStringLiteralLike(node) || ts.isNumericLiteral(node)) return [{ node, value: node.text }];
  if (ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node))
    return [{ node, value: node.text }];
  if (ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand)) return [{ node, value: node.getText() }];
  if (ts.isConditionalExpression(node))
    return [...dimensionLiterals(node.whenTrue), ...dimensionLiterals(node.whenFalse)];
  if (ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return [];
  const literals: { node: ts.Node; value: string }[] = [];
  ts.forEachChild(node, (child) => {
    literals.push(...dimensionLiterals(child));
  });
  return literals;
}

function assertValidSyntax(file: string, source: string): void {
  const result = ts.transpileModule(source, {
    fileName: file,
    reportDiagnostics: true,
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ESNext },
  });
  const error = result.diagnostics?.find((diagnostic) => diagnostic.category === ts.DiagnosticCategory.Error);
  if (error) throw new Error(`${file}: ${ts.flattenDiagnosticMessageText(error.messageText, '\n')}`);
}

function dimensionAssignment(node: ts.Node): { name: string; value: ts.Node } | undefined {
  if ((ts.isPropertyAssignment(node) || ts.isJsxAttribute(node)) && node.initializer) {
    return { name: propertyName(node.name) ?? '', value: node.initializer };
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
    if (ts.isPropertyAccessExpression(node.left)) return { name: node.left.name.text, value: node.right };
    if (ts.isElementAccessExpression(node.left) && ts.isStringLiteralLike(node.left.argumentExpression)) {
      return { name: node.left.argumentExpression.text, value: node.right };
    }
  }
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'setProperty'
  ) {
    const [name, value] = node.arguments;
    if (name && value && ts.isStringLiteralLike(name)) return { name: name.text, value };
  }
  return undefined;
}

function dimensionFindings(node: ts.Node): { node: ts.Node; kind: 'padding' | 'radius'; value: string }[] {
  const assignment = dimensionAssignment(node);
  const kind = dimensionKind(assignment?.name ?? '');
  if (!assignment || !kind) return [];
  return dimensionLiterals(assignment.value)
    .filter((literal) => hasRawDimension(literal.value, kind))
    .map((literal) => ({ ...literal, kind }));
}

export function scanScript(file: string, source: string): Finding[] {
  assertValidSyntax(file, source);
  const findings: Finding[] = [];
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true);
  const add = (node: ts.Node, kind: Finding['kind'], value: string): void => {
    const position = ast.getLineAndCharacterOfPosition(node.getStart(ast));
    findings.push({ file, line: position.line + 1, column: position.character + 1, kind, value });
  };
  const visit = (node: ts.Node): void => {
    if (
      ts.isStringLiteralLike(node) ||
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node)
    ) {
      for (const match of rawColors(node.text)) add(node, 'color', match.value);
    }
    for (const literal of dimensionFindings(node)) add(literal.node, literal.kind, literal.value);
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return findings;
}
