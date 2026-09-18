import { useCallback, useEffect, useRef } from 'react';

interface UseInfiniteScrollOptions {
  hasNextPage: boolean;
  loading: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}

const LOAD_MORE_THRESHOLD = 600;

export function useInfiniteScroll({
  hasNextPage,
  loading,
  loadingMore,
  onLoadMore,
}: UseInfiniteScrollOptions) {
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    loadingRef.current = loadingMore;
  }, [loadingMore]);

  const scrollRef = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
  }, []);

  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container || !hasNextPage || loading) {
      return;
    }

    const handleScroll = () => {
      if (loadingRef.current) {
        return;
      }

      const distanceFromBottom =
        container.scrollHeight -
        container.scrollTop -
        container.clientHeight;

      if (distanceFromBottom > LOAD_MORE_THRESHOLD) {
        return;
      }

      loadingRef.current = true;
      onLoadMore();
    };

    container.addEventListener('scroll', handleScroll, {
      passive: true,
    });

    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [hasNextPage, loading, onLoadMore]);

  return scrollRef;
}