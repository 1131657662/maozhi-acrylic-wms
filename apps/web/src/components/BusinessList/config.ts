import type { ExportKind } from '@wms/contracts';
import type { ProColumns } from '@ant-design/pro-components';
import type { ReactNode } from 'react';
import type { BusinessListLayout } from './layout';

export interface BusinessListConfig<Row> {
  name: ExportKind;
  title: string;
  icon?: ReactNode;
  description: string;
  extra?: ReactNode;
  columns: ProColumns<Row>[];
  emptyText?: ReactNode;
  exportInHeader?: boolean;
  onExportOpen?: () => void;
  skeleton?: boolean;
  designShell?: boolean;
  designViewToolbar?: boolean;
  resultCardTitle?: ReactNode;
  layout?: BusinessListLayout;
  chart?: ReactNode;
}
