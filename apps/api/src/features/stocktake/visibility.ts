import {
  hiddenStocktakeSchema,
  visibleStocktakeSchema,
  hiddenStocktakeLineSchema,
  visibleStocktakeLineSchema,
  type Stocktake,
  type StocktakeLine,
  type PublicStocktake,
  type PublicStocktakeLine,
} from '@wms/contracts';

export function isBlindHidden(take: Pick<Stocktake, 'mode' | 'revealedAt'>): boolean {
  return take.mode === 'blind' && take.revealedAt === null;
}
export function publicHeader(take: Stocktake): PublicStocktake {
  return isBlindHidden(take)
    ? hiddenStocktakeSchema.parse({ ...take, visibility: 'hidden' })
    : visibleStocktakeSchema.parse({ ...take, visibility: 'visible' });
}
export function publicLine(take: Pick<Stocktake, 'mode' | 'revealedAt'>, line: StocktakeLine): PublicStocktakeLine {
  return isBlindHidden(take)
    ? hiddenStocktakeLineSchema.parse({ ...line, visibility: 'hidden' })
    : visibleStocktakeLineSchema.parse({ ...line, visibility: 'visible' });
}
