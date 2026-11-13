import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button, Descriptions, Input, Space } from 'antd';
import { CATALOG_BARCODE_MAX_LENGTH } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { Card, EmptyState, StatusTag } from '../../components/ui';
import { spacing } from '../../theme/design-tokens';
import { catalogKeys } from './keys';
import { catalogQueryCopy } from './query-copy';
import { formatCatalogWeight } from './query-display';

export function CatalogLookup() {
  const [draft, setDraft] = useState('');
  const [barcode, setBarcode] = useState('');
  const query = useQuery({ ...catalogKeys.lookup(barcode), enabled: Boolean(barcode) });
  return (
    <Card title={catalogQueryCopy.lookupTitle} testId="catalog-barcode-lookup">
      <Space orientation="vertical" size={spacing[16]} style={{ width: '100%' }}>
        <Input.Search
          aria-label={catalogQueryCopy.lookupLabel}
          placeholder={catalogQueryCopy.lookupPlaceholder}
          maxLength={CATALOG_BARCODE_MAX_LENGTH}
          allowClear
          loading={query.isLoading}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onSearch={(value) => setBarcode(value.trim())}
          style={{ width: 'min(480px, 100%)' }}
        />
        {query.error && (
          <RequestError
            type="error"
            error={query.error}
            action={<Button onClick={() => void query.refetch()}>{catalogQueryCopy.retryLookup}</Button>}
          />
        )}
        {query.data?.found && <LookupResult spec={query.data.entry.sourceSpec} weight={query.data.entry.weightGrams} />}
        {query.data && !query.data.found && <EmptyState description={catalogQueryCopy.lookupNotFound} />}
      </Space>
    </Card>
  );
}

function LookupResult({ spec, weight }: { spec: string | null; weight: number }) {
  return (
    <Space orientation="vertical" size={spacing[8]}>
      <StatusTag status={catalogQueryCopy.lookupFound} type="success" />
      <Descriptions
        size="small"
        column={1}
        items={[
          { key: 'spec', label: catalogQueryCopy.spec, children: spec ?? catalogQueryCopy.noSpec },
          { key: 'weight', label: catalogQueryCopy.weight, children: formatCatalogWeight(weight) },
        ]}
      />
    </Space>
  );
}
