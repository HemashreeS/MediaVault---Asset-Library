import { useQuery } from '@tanstack/react-query';
import { listAssets } from '@/api/client';
import type { AssetQuery } from '@/lib/types';
import { useDebouncedValue } from './useDebouncedValue';


/**
 * Baseline loader. Reviewers know this hook is wrong in several ways.
 * Replacing it wholesale is expected and encouraged.
 */
export function useAssets(query: AssetQuery) {
  const debouncedQ = useDebouncedValue(query.q ?? '', 300);

  const requestQuery: AssetQuery = {
    ...query,
    q: debouncedQ.trim() || undefined,
  };

  const result = useQuery({
    queryKey: ['assets', requestQuery],
    queryFn: ({ signal }) => listAssets(requestQuery, signal),
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  return {
    items: result.data?.items ?? [],
    total: result.data?.total ?? 0,
    nextCursor: result.data?.nextCursor ?? null,
    loading: result.isPending,
    error: result.error instanceof Error ? result.error.message : null,
  };
}
