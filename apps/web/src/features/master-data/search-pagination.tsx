import { Button, Space } from 'antd';
import { MASTER_PAGE_SIZE, masterSearchCopy as t } from './copy';

interface Props {
  page: number;
  total: number;
  disabled: boolean;
  onChange: (page: number) => void;
}
export function SearchPagination({ page, total, disabled, onChange }: Props) {
  return (
    <Space onMouseDown={(event) => event.preventDefault()}>
      <Button size="small" disabled={disabled || page <= 1} onClick={() => onChange(page - 1)}>
        {t.previous}
      </Button>
      <span>
        {page} / {Math.max(1, Math.ceil(total / MASTER_PAGE_SIZE))}
      </span>
      <Button size="small" disabled={disabled || page * MASTER_PAGE_SIZE >= total} onClick={() => onChange(page + 1)}>
        {t.next}
      </Button>
    </Space>
  );
}
