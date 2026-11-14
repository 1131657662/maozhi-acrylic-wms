import type { ReactNode } from 'react';
import { ListViewToolbar } from './list-view-toolbar';
import type { ListView } from './use-list-views';
import { theme } from 'antd';

interface Props {
  identity: string;
  scopeKey: string;
  design?: boolean;
  views: ListView[];
  apply: (view: ListView) => void;
  save: (name: string) => void;
  remove: (name: string) => void;
  children: ReactNode;
}

export function BusinessListFilterContent({ identity, scopeKey, design, views, apply, save, remove, children }: Props) {
  const { token } = theme.useToken();
  return (
    <>
      {identity !== 'anonymous' && (
        <div className="business-list-view-toolbar" style={{ marginBottom: token.marginSM }}>
          <ListViewToolbar key={scopeKey} design={design} views={views} apply={apply} save={save} remove={remove} />
        </div>
      )}
      {children}
    </>
  );
}
