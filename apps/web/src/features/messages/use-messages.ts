import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { messageKeys, type MessageFilters } from './keys';
export function useMessages(filters: MessageFilters) {
  return useQuery({ ...messageKeys.list(filters), placeholderData: keepPreviousData, retry: false });
}
