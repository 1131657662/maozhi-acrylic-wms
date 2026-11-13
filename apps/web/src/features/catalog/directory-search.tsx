import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card } from '../../components/ui';
import { catalogKeys } from './keys';
import { catalogQueryCopy, CATALOG_QUERY_DEFAULT_PAGE_SIZE } from './query-copy';
import { DirectorySearchTable } from './directory-search-table';
import { BarcodeTraceDrawer } from './barcode-trace-drawer';

export function CatalogDirectorySearch() {
  const [query, setQuery] = useState({ q: '', page: 1, pageSize: CATALOG_QUERY_DEFAULT_PAGE_SIZE });
  const [barcode, setBarcode] = useState<string | null>(null);
  const result = useQuery(catalogKeys.search(query));
  return (
    <>
      <Card title={catalogQueryCopy.searchTitle} testId="catalog-directory-search">
        <DirectorySearchTable
          query={query}
          result={result.data}
          loading={result.isLoading}
          error={result.error}
          onSearch={(q) => setQuery((current) => ({ ...current, q, page: 1 }))}
          onPage={(page, pageSize) =>
            setQuery((current) => ({ ...current, page: pageSize === current.pageSize ? page : 1, pageSize }))
          }
          onTrace={setBarcode}
          onRetry={() => void result.refetch()}
        />
      </Card>
      <BarcodeTraceDrawer barcode={barcode} onClose={() => setBarcode(null)} />
    </>
  );
}
