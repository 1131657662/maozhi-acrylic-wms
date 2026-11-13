import { Button, Space, Typography } from 'antd';
import { catalogUploadErrorsSchema } from '@wms/contracts';
import { ApiError } from '../../api/client';
import { spacing } from '../../theme/design-tokens';
import { catalogReadCopy } from './export-copy';
import { uploadErrorCsv } from './upload-error-csv';

export function UploadErrors({ error }: { error: unknown }) {
  const report = catalogUploadErrorsSchema.safeParse(error instanceof ApiError ? error.data : null);
  if (!report.success || !report.data.errors.length) return null;
  const download = () => {
    const url = URL.createObjectURL(new Blob([uploadErrorCsv(report.data)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = catalogReadCopy.errorsFile;
    link.click();
    URL.revokeObjectURL(url);
  };
  return (
    <Space wrap size={spacing[8]} data-testid="catalog-upload-errors">
      <Typography.Text>
        {report.data.truncated ? catalogReadCopy.tooManyErrors : catalogReadCopy.errorCount(report.data.errors.length)}
      </Typography.Text>
      <Button onClick={download}>{catalogReadCopy.downloadErrors}</Button>
    </Space>
  );
}
