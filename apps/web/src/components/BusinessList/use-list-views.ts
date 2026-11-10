import { useState } from 'react';
import type { ColumnsState } from '@ant-design/pro-components';
import { WEB_LIST_VIEW_SCHEMA_VERSION } from '@wms/contracts';
import { z } from 'zod';
import type { ListParams } from '../../features/web-lists/keys';
import type { ListState } from './use-list-state';

const columnStateSchema = z.record(
  z.string(),
  z.object({
    show: z.boolean().optional(),
    order: z.number().optional(),
    fixed: z.enum(['left', 'right']).optional(),
  }),
);
const viewSchema = z
  .strictObject({
    schemaVersion: z.literal(WEB_LIST_VIEW_SCHEMA_VERSION),
    name: z.string().trim().min(1).max(40),
    params: z.record(z.string(), z.string()),
    columns: columnStateSchema,
    unit: z.string().max(32).optional(),
  })
  .refine((view) => !('traceId' in view.params));
const viewsSchema = z.array(viewSchema).max(20);
export type ListView = z.infer<typeof viewSchema>;

interface Options {
  kind: string;
  identity: string;
  state: ListState;
  columns: Record<string, ColumnsState>;
  applyColumns: (next: Record<string, ColumnsState>) => void;
}

function storageKey(kind: string, identity: string): string {
  return `b6b-list-views:${encodeURIComponent(identity)}:${kind}:v${WEB_LIST_VIEW_SCHEMA_VERSION}`;
}
function loadViews(key: string): ListView[] {
  try {
    return viewsSchema.parse(JSON.parse(localStorage.getItem(key) ?? '[]'));
  } catch {
    try {
      localStorage.removeItem(key);
    } catch {
      /* Invalid or unavailable preferences fall back to defaults. */
    }
    return [];
  }
}
function viewParams(params: ListParams): ListParams {
  return Object.fromEntries(Object.entries(params).filter(([key]) => key !== 'page' && key !== 'traceId'));
}

export function useListViews({ kind, identity, state, columns, applyColumns }: Options) {
  const key = storageKey(kind, identity);
  const [stored, setStored] = useState<{ key: string; views: ListView[] }>(() => ({ key, views: loadViews(key) }));
  const views = stored.key === key ? stored.views : loadViews(key);
  function persist(next: ListView[]): void {
    setStored({ key, views: next });
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* Saved views remain available for this session. */
    }
  }
  function save(name: string): void {
    const view: ListView = {
      schemaVersion: WEB_LIST_VIEW_SCHEMA_VERSION,
      name: name.trim(),
      params: viewParams(state.params),
      columns,
      ...(state.params.unit ? { unit: state.params.unit } : {}),
    };
    persist([...views.filter((item) => item.name !== view.name), view].slice(-20));
  }
  function apply(view: ListView): void {
    state.searchFor(view.params);
    applyColumns(view.columns);
  }
  function remove(name: string): void {
    persist(views.filter((item) => item.name !== name));
  }
  return { views, save, apply, remove };
}
