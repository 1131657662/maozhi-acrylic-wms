import { Button, Space } from 'antd';
import { columnText } from './column-settings';

export function ColumnReset({ resetWidths, resetAll }: { resetWidths: () => void; resetAll: () => void }) {
  return (
    <Space size="small">
      <Button type="link" size="small" onClick={resetWidths}>
        {columnText.resetWidths}
      </Button>
      <Button type="link" size="small" aria-label={columnText.resetAll} onClick={resetAll}>
        {columnText.resetLabel}
      </Button>
    </Space>
  );
}
