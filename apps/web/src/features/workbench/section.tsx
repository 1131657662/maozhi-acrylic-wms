import type { ReactNode } from 'react';
import { Alert } from 'antd';
import { Link } from '@umijs/max';
import { workbenchCopy as copy, type WorkbenchBlock } from '@wms/contracts';
import { Card } from '../../components/ui/Card';

export function Section<T>({
  title,
  block,
  href,
  action,
  children,
}: {
  title: string;
  block: WorkbenchBlock<T>;
  href: string;
  action: string;
  children: (data: T) => ReactNode;
}) {
  return (
    <Card title={title} extra={<Link to={href}>{action}</Link>}>
      {block.data !== null ? (
        children(block.data)
      ) : (
        <Alert type={block.verification === 'failed' ? 'error' : 'info'} title={block.reason ?? copy.failed} showIcon />
      )}
    </Card>
  );
}
