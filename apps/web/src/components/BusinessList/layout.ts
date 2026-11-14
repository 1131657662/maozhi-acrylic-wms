import type { ExportKind } from '@wms/contracts';
import type { ComponentType, ReactNode } from 'react';

export interface BusinessListLayoutProps {
  name: ExportKind;
  title: string;
  icon?: ReactNode;
  description: string;
  actions?: ReactNode;
  filters: ReactNode;
  beforeResults?: ReactNode;
  chart?: ReactNode;
  results: ReactNode;
}

export type BusinessListLayout = ComponentType<BusinessListLayoutProps>;
