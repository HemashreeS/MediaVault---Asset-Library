import { useInfiniteQuery } from '@tanstack/react-query';
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

  const result = useInfiniteQuery({
    queryKey: ['assets', requestQuery],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam, signal }) => listAssets({...requestQuery, cursor: pageParam}, signal),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  const items = result.data?.pages.flatMap((page) => page.items) ?? [];

  const total = result.data?.pages[0]?.total ?? 0;

  const nextCursor = result.data?.pages.at(-1)?.nextCursor ?? null;

  return {
    items,
    total,
    nextCursor,
    loading: result.isPending,
    loadingMore: result.isFetchingNextPage,
    hasNextPage: result.hasNextPage,
    fetchNextPage: result.fetchNextPage,
    error: result.error instanceof Error ? result.error.message : null,
  };
}
