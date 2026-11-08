import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Button } from 'antd';
import { stocktakeKeys } from './keys';
import { StocktakePostDrawer } from './post-drawer';

export function StocktakePostPanel({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  const {
    data: preview,
    isFetching: isLoading,
    error: previewError,
    refetch,
  } = useQuery({ ...stocktakeKeys.preview(id), enabled: false });
  async function show() {
    const next = await refetch();
    if (next.data && !next.error) setOpen(true);
  }
  return (
    <>
      <Button type="primary" loading={isLoading} onClick={() => void show()}>
        核对差异并回写
      </Button>
      {previewError && (
        <Alert type="error" title={previewError.message} description="预览未载入，未执行回写。请重试。" />
      )}
      {open && preview && <StocktakePostDrawer initial={preview} onClose={() => setOpen(false)} />}
    </>
  );
}
