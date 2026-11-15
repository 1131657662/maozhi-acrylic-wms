// One display gate for cards, chart, context and table, including cached refetches.
export function reportDisplayQuery<
  T extends { data?: unknown; isFetching: boolean; isPending: boolean; error: Error | null },
>(query: T) {
  return {
    ...query,
    data: query.isFetching || query.error ? undefined : query.data,
    isPending: query.isPending || query.isFetching,
  };
}
