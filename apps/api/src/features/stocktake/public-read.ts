import { publicStocktakePreviewSchema, type StocktakeQuery, type StocktakeLine } from '@wms/contracts';
import type { Database } from '../../db/mysql.ts';
import { getStocktake, listStocktakes, stocktakeLines } from './read-model.ts';
import { stocktakePreview } from './preview.ts';
import { publicHeader, publicLine } from './visibility.ts';

export async function publicStocktakeList(db: Database, query: StocktakeQuery) {
  const result = await listStocktakes(db, query);
  return { ...result, items: result.items.map(publicHeader) };
}
export async function publicStocktakeDetail(db: Database, id: string) {
  return publicHeader(await getStocktake(db, id));
}
export async function publicStocktakeLines(db: Database, id: string, query: StocktakeQuery) {
  const take = await getStocktake(db, id);
  const result = await stocktakeLines(db, id, query);
  return { ...result, items: result.items.map((line) => publicLine(take, line)) };
}
export async function publicReadingResult(db: Database, id: string, line: StocktakeLine) {
  return publicLine(await getStocktake(db, id), line);
}
export async function publicStocktakePreview(db: Database, id: string) {
  const preview = await stocktakePreview(db, id);
  return publicStocktakePreviewSchema.parse({ ...preview, stocktake: publicHeader(preview.stocktake) });
}
