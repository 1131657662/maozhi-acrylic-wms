import type { BackupBaseline } from '@wms/contracts';

type Comparison = [label: string, expected: string | null, actual: string];
type Cell = BackupBaseline['inventory']['cells'][number];
type PhysicalCell = Extract<BackupBaseline, { version: 2 }>['inventory']['cells'][number];

function physicalRows(cells: PhysicalCell[]) {
  return new Map(cells.map((cell) => [JSON.stringify([cell.warehouse, cell.product, cell.sourceDelFlag]), cell]));
}

function legacyCounts(cells: Cell[]) {
  const counts = new Map<string, { cell: Cell; count: number }>();
  for (const cell of cells) {
    const key = JSON.stringify([cell.warehouse, cell.product, cell.packages, cell.tonnes]);
    counts.set(key, { cell, count: (counts.get(key)?.count ?? 0) + 1 });
  }
  return counts;
}

function* compareLegacy(expected: BackupBaseline, actual: BackupBaseline): Generator<Comparison> {
  const before = legacyCounts(expected.inventory.cells),
    after = legacyCounts(actual.inventory.cells);
  for (const key of new Set([...before.keys(), ...after.keys()])) {
    const left = before.get(key),
      right = after.get(key);
    const { cell } = (left ?? right)!;
    yield [
      `仓库 ${cell.warehouse} / 商品 ${cell.product} / ${cell.packages} 包 ${cell.tonnes} 吨的记录数`,
      String(left?.count ?? 0),
      String(right?.count ?? 0),
    ];
  }
}

export function* inventoryComparisons(
  expected: BackupBaseline | null,
  actual: Extract<BackupBaseline, { version: 2 }>,
): Generator<Comparison> {
  if (expected?.version === 1) {
    yield* compareLegacy(expected, actual);
    return;
  }
  const before = physicalRows(expected?.inventory.cells ?? []),
    after = physicalRows(actual.inventory.cells);
  for (const key of [...new Set([...before.keys(), ...after.keys()])].sort()) {
    const left = before.get(key),
      right = after.get(key),
      cell = (left ?? right)!;
    const label = `仓库 ${cell.warehouse} / 商品 ${cell.product} / ${cell.sourceDelFlag === 0 ? '有效记录' : '已删除记录'}`;
    yield [`${label}包数`, expected ? (left?.packages ?? '不存在') : null, right?.packages ?? '不存在'];
    yield [`${label}吨数`, expected ? (left?.tonnes ?? '不存在') : null, right?.tonnes ?? '不存在'];
  }
}
