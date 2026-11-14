import { useState } from 'react';
import { Button } from 'antd';
import { discoveryCopy } from '@wms/contracts';
import { DiscoveryDrawer } from './discovery-drawer';

export function DiscoveryCreate({ id }: { id: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>{discoveryCopy.register}</Button>
      {open && <DiscoveryDrawer id={id} onClose={() => setOpen(false)} />}
    </>
  );
}
