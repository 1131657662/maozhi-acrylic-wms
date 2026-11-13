import { Button, Space } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import type { CatalogExportQuery } from '@wms/contracts';
import { RequestError } from '../../components/RequestError';
import { spacing } from '../../theme/design-tokens';
import { catalogReadCopy } from './export-copy';
import { useCatalogExport } from './use-catalog-export';

export function CatalogExportButton({ query, disabled }: { query: CatalogExportQuery | null; disabled: boolean }) {
  const { mutate: download, isPending: exporting, error: exportError } = useCatalogExport();
  return (
    <Space orientation="vertical" size={spacing[8]}>
      <Button
        icon={<DownloadOutlined />}
        loading={exporting}
        disabled={disabled || !query || exporting}
        onClick={() => {
          if (query) download(query);
        }}
      >
        {catalogReadCopy.export}
      </Button>
      {exportError && <RequestError type="error" error={exportError} />}
    </Space>
  );
}
