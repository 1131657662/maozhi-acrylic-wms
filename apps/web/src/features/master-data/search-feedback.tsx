import { Spin } from 'antd';
import type { MasterCatalog } from '@wms/contracts';
import { masterSearchCopy as t } from './copy';

interface Props {
  catalog: MasterCatalog | 'vehicles';
  loading: boolean;
  hasInput: boolean;
  error: unknown;
}
export function SearchFeedback({ catalog, loading, hasInput, error }: Props) {
  if (loading)
    return (
      <span role="status" aria-label={t.loading}>
        <Spin size="small" />
      </span>
    );
  if (!hasInput) return <span role="status">{t.prompt}</span>;
  return <span role="status">{error ? t.failed : t.empty[catalog]}</span>;
}
