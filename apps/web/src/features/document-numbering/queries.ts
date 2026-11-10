import { createQueryKeys } from '@lukemorales/query-key-factory';
import { numberingRulesSchema } from '@wms/contracts';
import { request } from '../../api/client';

export const numberingKeys = createQueryKeys('document-numbering', {
  rules: { queryKey: null, queryFn: () => request('/document-numbering', numberingRulesSchema) },
});
