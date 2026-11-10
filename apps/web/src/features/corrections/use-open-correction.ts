import { errorMessage } from '../../api/errors';
import { useState } from 'react';
import { App } from 'antd';
import { useQueryClient } from '@tanstack/react-query';
import type { CorrectionSummary, CorrectionTarget } from '@wms/contracts';
import { correctionKeys } from './keys';

export function useOpenCorrection(target: CorrectionTarget) {
  const client = useQueryClient(),
    { message } = App.useApp();
  const [snapshot, setSnapshot] = useState<CorrectionSummary | null>(null);
  const [loading, setLoading] = useState(false);
  async function open() {
    setLoading(true);
    try {
      const data = await client.fetchQuery({ ...correctionKeys.detail(target.kind, target.id), staleTime: 0 });
      if (!data.corrections?.allowed) throw new Error('仅本地已入账且未终结的单据可以更正；历史导入单只能库存调整');
      setSnapshot(data.corrections);
    } catch (error) {
      void message.error(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }
  return { snapshot, loading, open, close: () => setSnapshot(null) };
}
