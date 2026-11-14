import type { LedgerEvent } from './types.ts';
export { ageBuckets } from './fifo-buckets.ts';

interface Layer {
  id: string;
  ageDay: string;
  grams: number;
  consumed: number;
  reversed: boolean;
}
interface Allocation {
  layerId: string;
  grams: number;
  restored: number;
}
export interface FifoState {
  layers: Layer[];
  activeIds: Set<string>;
  byId: Map<string, Layer>;
  outbound: Map<string, Allocation[]>;
  tainted: boolean;
  balanceGrams: number | null;
  layerTotalGrams: number;
}
export function emptyFifo(): FifoState {
  return {
    layers: [],
    activeIds: new Set(),
    byId: new Map(),
    outbound: new Map(),
    tainted: false,
    balanceGrams: null,
    layerTotalGrams: 0,
  };
}
export function markFifoUnknown(state: FifoState): void {
  state.tainted = true;
  state.layers = [];
  state.activeIds.clear();
  state.layerTotalGrams = 0;
}
function markUnknown(state: FifoState): void {
  markFifoUnknown(state);
}
function addLayer(state: FifoState, layer: Layer, restoredGrams = layer.grams): void {
  state.byId.set(layer.id, layer);
  if (state.activeIds.has(layer.id)) {
    const existing = state.layers.findIndex((current) => current.id === layer.id);
    if (existing >= 0) state.layers.splice(existing, 1);
    state.activeIds.delete(layer.id);
  }
  const last = state.layers.at(-1);
  if (!last || last.ageDay < layer.ageDay || (last.ageDay === layer.ageDay && last.id < layer.id)) {
    state.layers.push(layer);
    state.activeIds.add(layer.id);
    state.layerTotalGrams += restoredGrams;
    return;
  }
  let low = 0,
    high = state.layers.length;
  while (low < high) {
    const mid = (low + high) >>> 1,
      current = state.layers[mid]!;
    if (current.ageDay < layer.ageDay || (current.ageDay === layer.ageDay && current.id < layer.id)) low = mid + 1;
    else high = mid;
  }
  state.layers.splice(low, 0, layer);
  state.activeIds.add(layer.id);
  state.layerTotalGrams += restoredGrams;
}
function takeOldest(state: FifoState, operationId: string, grams: number): boolean {
  let remaining = grams;
  const allocations: Allocation[] = [];
  while (remaining > 0 && state.layers.length) {
    const layer = state.layers[0]!;
    if (layer.grams <= 0) {
      state.layers.shift();
      state.activeIds.delete(layer.id);
      continue;
    }
    const amount = Math.min(remaining, layer.grams);
    layer.grams -= amount;
    layer.consumed += amount;
    state.layerTotalGrams -= amount;
    remaining -= amount;
    allocations.push({ layerId: layer.id, grams: amount, restored: 0 });
  }
  if (remaining > 0) return false;
  state.outbound.set(operationId, allocations);
  return true;
}
function restoreOutbound(state: FifoState, event: LedgerEvent, grams: number): boolean {
  const allocations = state.outbound.get(event.originalOperationId ?? '');
  if (!allocations) return false;
  let remaining = grams;
  for (const allocation of allocations) {
    const layer = state.byId.get(allocation.layerId),
      available = allocation.grams - allocation.restored;
    if (!layer || layer.reversed || available < 0) return false;
    const amount = Math.min(remaining, available);
    if (amount > 0) {
      layer.grams += amount;
      allocation.restored += amount;
      remaining -= amount;
      addLayer(state, layer, amount);
    }
    if (remaining === 0) break;
  }
  return remaining === 0;
}
function reverseInbound(state: FifoState, event: LedgerEvent, grams: number): boolean {
  const layer = state.byId.get(event.originalOperationId ?? '');
  if (!layer || layer.reversed || layer.consumed > 0 || layer.grams < grams) return false;
  layer.grams -= grams;
  state.layerTotalGrams -= grams;
  layer.reversed = layer.grams === 0;
  if (layer.reversed) {
    state.layers = state.layers.filter((item) => item.id !== layer.id);
    state.activeIds.delete(layer.id);
  }
  return true;
}
export function applyFifo(state: FifoState, event: LedgerEvent, afterGrams: number | null): void {
  const beforeGrams = event.beforeGrams;
  if (beforeGrams === null || !Number.isSafeInteger(beforeGrams) || beforeGrams < 0 || afterGrams === null)
    markUnknown(state);
  else if (state.balanceGrams === null) {
    if (beforeGrams > 0) markUnknown(state);
    else state.balanceGrams = 0;
  } else if (state.balanceGrams !== beforeGrams) markUnknown(state);
  if (state.tainted) {
    if (afterGrams === 0) {
      state.tainted = false;
      state.layers = [];
      state.activeIds.clear();
      state.byId.clear();
      state.outbound.clear();
      state.layerTotalGrams = 0;
    }
    state.balanceGrams = afterGrams;
    return;
  }
  const grams = Math.abs(event.deltaGrams),
    operationId = event.operationId ?? event.id;
  let valid = true;
  const family = event.operationType === 'stock.correct' ? 'correction' : event.family;
  if (family === 'inbound' && !event.reverse && grams > 0) {
    const ageDay = validAgeDay(event.businessDate, event.localTime);
    if (!ageDay) valid = false;
    else addLayer(state, { id: operationId, ageDay, grams, consumed: 0, reversed: false });
  } else if (family === 'outbound' && !event.reverse && grams > 0) valid = takeOldest(state, operationId, grams);
  else if (family === 'outbound' && event.reverse && grams > 0) valid = restoreOutbound(state, event, grams);
  else if (family === 'inbound' && event.reverse && grams > 0) valid = reverseInbound(state, event, grams);
  else if (grams !== 0) valid = false;
  if (!valid) markUnknown(state);
  if (afterGrams === 0) {
    state.tainted = false;
    state.layers = [];
    state.activeIds.clear();
    state.byId.clear();
    state.outbound.clear();
    state.layerTotalGrams = 0;
  } else if (
    afterGrams === null ||
    !Number.isSafeInteger(afterGrams) ||
    afterGrams < 0 ||
    state.layerTotalGrams !== afterGrams
  ) {
    markUnknown(state);
  }
  state.balanceGrams = afterGrams;
}
function validAgeDay(businessDate: string | null, localTime: string | null): string | null {
  const candidate = businessDate?.slice(0, 10) ?? localTime?.slice(0, 10);
  return candidate && localTime && /^\d{4}-\d{2}-\d{2}$/.test(candidate) && candidate <= localTime.slice(0, 10)
    ? candidate
    : null;
}
