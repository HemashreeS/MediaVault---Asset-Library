import { useEffect, useRef } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { listAssets } from '@/api/client';
import type { AssetQuery } from '@/lib/types';
import { useDebouncedValue } from './useDebouncedValue';
import { useOnlineStatus } from '@/lib/useOnlineStatus';

/**
 * Loads assets with centralized API retries and offline awareness.
 *
 * - API retry behavior is handled in api/client.ts.
 * - Queries are disabled while offline.
 * - When connectivity returns, the current asset query is explicitly refetched.
 */
export function useAssets(query: AssetQuery) {
  const isOnline = useOnlineStatus();
  const wasOnline = useRef(isOnline);

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

    // Retries are centralized in api/client.ts.
    retry: false,

    // Don't initiate asset requests while offline.
    enabled: isOnline,

    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    const cameBackOnline = !wasOnline.current && isOnline;

    if (cameBackOnline) {
      void result.refetch();
    }

    wasOnline.current = isOnline;
  }, [isOnline, result.refetch]);

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
    isOnline,
  };
}