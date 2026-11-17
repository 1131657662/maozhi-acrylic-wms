import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSqlStructure } from '../src/features/maintenance/sql-structure.ts';

test('B8a-2 触发器结构忽略引号外空白但保留正文字符串与注释边界', () => {
  assert.equal(
    normalizeSqlStructure('BEGIN\r\n SELECT 1;\r\nEND'),
    normalizeSqlStructure('BEGIN\r\r\n SELECT 1;\r\r\nEND'),
  );
  assert.notEqual(normalizeSqlStructure("SELECT 'a\nb'"), normalizeSqlStructure("SELECT 'a\n\nb'"));
  assert.notEqual(normalizeSqlStructure('SELECT 1 -- comment\n + 1'), normalizeSqlStructure('SELECT 1 -- comment + 1'));
  assert.equal(normalizeSqlStructure("SELECT 'it\\'s  unchanged', `a  b`"), "SELECT 'it\\'s  unchanged', `a  b`");
});
