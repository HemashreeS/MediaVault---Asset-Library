import { useCallback, useState } from 'react';
import type { InfiniteData } from '@tanstack/react-query';
import { bulkSetStatus } from '@/api/client';
import { AssetDetail } from '@/features/assets/AssetDetail';
import { AssetGrid } from '@/features/assets/AssetGrid';
import { useAssets } from '@/features/assets/useAssets';
import { statusLabel } from '@/lib/format';
import type { Asset, AssetPage, AssetStatus, AssetQuery } from '@/lib/types';
import { useAssetUrlQuery } from './features/assets/useAssetUrlQuery';
import { useInfiniteScroll } from './features/assets/useInfiniteScroll';
import { queryClient } from './lib/queryClient';

const STATUSES: AssetStatus[] = ['draft', 'in_review', 'approved', 'archived'];
const SORTS: Array<{ value: NonNullable<AssetQuery['sort']>; label: string }> = [
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'sizeBytes:desc', label: 'Largest first' },
  { value: 'createdAt:desc', label: 'Newest' },
];

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex++;
      if (index >= tasks.length) {
        return;
      }
      const task = tasks[index];
      if (!task) {
        return;
      }
      results[index] = await task();
    }
  }

  const workerCount = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));
  return results;
}

type BulkChunkResult =
  | {
      ids: string[];
      result: Awaited<ReturnType<typeof bulkSetStatus>>;
    }
  | {
      ids: string[];
      error: Error;
    };

type BulkFailure = {
  id: string;
  name: string;
  reason: string;
  retryable: boolean;
};

async function runBulkStatusUpdate(
  ids: string[],
  status: AssetStatus,
): Promise<BulkChunkResult[]> {
  const chunks = chunk(ids, 50);

  const tasks = chunks.map((idsChunk) => {
    return async (): Promise<BulkChunkResult> => {
      try {
        const result = await bulkSetStatus(idsChunk, status);

        return {
          ids: idsChunk,
          result,
        };
      } catch (error) {
        return {
          ids: idsChunk,
          error:
            error instanceof Error
              ? error
              : new Error('Bulk update failed'),
        };
      }
    };
  });

  // At most 3 requests are in flight at once.
  return runWithConcurrency(tasks, 3);
}

function updateAssetsInCache(
  data: InfiniteData<AssetPage, string | undefined> | undefined,
  ids: Set<string>,
  update: (asset: Asset) => Asset,
) {
  if (!data) {
    return data;
  }

  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((asset) =>
        ids.has(asset.id) ? update(asset) : asset,
      ),
    })),
  };
}

export function App() {
  const { query: urlQuery, updateQuery } = useAssetUrlQuery();

  const q = urlQuery.q ?? '';
  const status = urlQuery.status ?? [];
  const sort = urlQuery.sort ?? 'updatedAt:desc';
  const kind = urlQuery.kind ?? [];
  const tag = urlQuery.tag ?? [];

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastSelectedId, setLastSelectedId] =
    useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [retryableIds, setRetryableIds] = useState<Set<string>>(new Set());
  const [retryStatus, setRetryStatus] = useState<AssetStatus | null>(null);
  const [bulkUpdating, setBulkUpdating] = useState(false);

  const { items, total, loading, error, loadingMore, hasNextPage, fetchNextPage } = useAssets({ q, status, kind, tag, sort, limit: 24 });
  const scrollRef = useInfiniteScroll({ hasNextPage, loading, loadingMore, onLoadMore: fetchNextPage });

  const toggleSelect = useCallback((id: string, shiftKey = false) => {
      if (bulkUpdating) {
        return;
      }
      setRetryableIds(new Set());
      setRetryStatus(null);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (shiftKey && lastSelectedId) {
          const startIndex = items.findIndex(
            (asset) => asset.id === lastSelectedId,
          );
          const endIndex = items.findIndex(
            (asset) => asset.id === id,
          );
          if (startIndex !== -1 && endIndex !== -1) {
            const start = Math.min(startIndex,endIndex);
            const end = Math.max(startIndex,endIndex);
            for ( let index = start; index <= end; index += 1 ) {
              const asset = items[index];
              if (asset) {
                next.add(asset.id);
              }
            }
            return next;
          }
        }

        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }

        return next;
      });
      setLastSelectedId(id);
    },
    [items, lastSelectedId, bulkUpdating],
  );

  const selectAllLoaded = useCallback(() => {
    if (bulkUpdating) {
      return;
    }
    setSelectedIds(
      new Set(items.map((asset) => asset.id)),
    );
    setRetryableIds(new Set());
    setRetryStatus(null);
  }, [items, bulkUpdating]);

  const allLoadedSelected = items.length > 0 &&
    items.every((asset) =>
      selectedIds.has(asset.id),
    );

  async function applyBulkStatus( next: AssetStatus, idsToUpdate: string[] = [...selectedIds]) {
    if (bulkUpdating) {
      return;
    }
    const ids = idsToUpdate;
    if (ids.length === 0) return;
    setBulkUpdating(true);
    setNotice(null);
    setRetryableIds(new Set());
    setRetryStatus(null);
    try {
      const selectedIdSet = new Set(ids);
      const snapshot = new Map<string, Asset>();
      queryClient.setQueriesData<
        InfiniteData<AssetPage, string | undefined>
      >(
        { queryKey: ['assets'] },
        (data) =>
          updateAssetsInCache(
            data,
            selectedIdSet,
            (asset) => {
              snapshot.set(asset.id, asset);
              return {
                ...asset,
                status: next,
              };
            },
          ),
      );

      const results = await runBulkStatusUpdate(
        ids,
        next,
      );

      const failedIds = new Set<string>();
      const retryableFailedIds = new Set<string>();
      const failures: BulkFailure[] = [];

      for (const chunkResult of results) {
        if ('result' in chunkResult) {
          for (const result of chunkResult.result.results) {
            if (result.ok) {
              queryClient.setQueriesData<
                InfiniteData<
                  AssetPage,
                  string | undefined
                >
              >(
                { queryKey: ['assets'] },
                (data) =>
                  updateAssetsInCache(
                    data,
                    new Set([result.id]),
                    () => result.asset,
                  ),
              );
            } else {
              failedIds.add(result.id);
              const reason = result.message ?? result.code;
              const originalAsset = snapshot.get(result.id);
              const retryable = result.code !== 'legal_hold';
              failures.push({
                id: result.id,
                name:
                  originalAsset?.name ??
                  result.id,
                reason,
                retryable,
              });

              if (retryable) {
                retryableFailedIds.add(
                  result.id,
                );
              }
            }
          }
        } else {
          for (const id of chunkResult.ids) {
            failedIds.add(id);

            const originalAsset =
              snapshot.get(id);

            failures.push({
              id,
              name:
                originalAsset?.name ?? id,
              reason:
                chunkResult.error.message,
              retryable: true,
            });

            retryableFailedIds.add(id);
          }
        }
      }
      if (failedIds.size > 0) {
        queryClient.setQueriesData<
          InfiniteData<AssetPage, string | undefined>
        >(
          { queryKey: ['assets'] },
          (data) =>
            updateAssetsInCache(
              data,
              failedIds,
              (asset) =>
                snapshot.get(asset.id) ??
                asset,
            ),
        );
      }
      setRetryableIds(retryableFailedIds);
      if (retryableFailedIds.size > 0) {
        setRetryStatus(next);
      } else {
        setRetryStatus(null);
      }
      const applied = ids.length - failedIds.size;
      const failed = failedIds.size;
      if (failed === 0) {
        setNotice( `${applied} updated successfully.` );
        setSelectedIds(new Set());
        setLastSelectedId(null);
      } else {
        const failureText = failures
          .map((failure) => `${failure.name} — ${failure.reason}`)
          .join('; ');
        setNotice(`${applied} updated, ${failed} failed. ${failureText}` );
        setSelectedIds(failedIds);
        const lastFailedId = ids.find((id) => failedIds.has(id)) ?? null;
        setLastSelectedId(lastFailedId);
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message : 'Bulk update failed';

      setNotice( `Bulk update failed. ${message}`,
      );
    } finally {
      setBulkUpdating(false);
    }
  }

  function handleSaved(asset: Asset) {
    queryClient.setQueriesData<
      InfiniteData<AssetPage, string | undefined>
    >(
      { queryKey: ['assets'] },
      (data) =>
        updateAssetsInCache(
          data,
          new Set([asset.id]),
          () => asset,
        ),
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>MediaVault</h1>
        <input
          className="search"
          type="search"
          placeholder="Search assets"
          value={q}
          onChange={(e) => updateQuery({ q: e.target.value })}
          disabled={bulkUpdating}
        />
        <select value={sort} onChange={(e) => updateQuery({ sort: e.target.value as NonNullable<AssetQuery['sort']>})} disabled={bulkUpdating}>
          {SORTS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </header>

      <div className="filters">
        {STATUSES.map((s) => (
          <label key={s}>
            <input
              type="checkbox"
              checked={status.includes(s)}
              onChange={(e) => {
                const nextStatus = e.target.checked
                  ? [...status, s]
                  : status.filter((x) => x !== s);

                updateQuery({ status: nextStatus });
              }}
              disabled={bulkUpdating}
            />
            {statusLabel(s)}
          </label>
        ))}
        <span className="muted">
          {loading ? 'Loading…' : error ? "Unable to load results..." : `${items.length} of ${total.toLocaleString()} shown`}
        </span>
      </div>

      {items.length > 0 && (
        <div className="bulkbar">
          <label>
            <input
              type="checkbox"
              checked={allLoadedSelected}
              onChange={(event) => {
                if (bulkUpdating) {
                  return;
                }

                if (event.target.checked) {
                  selectAllLoaded();
                } else {
                  setSelectedIds(
                    new Set(),
                  );
                  setLastSelectedId(null);
                  setRetryableIds(
                    new Set(),
                  );
                  setRetryStatus(null);
                }
              }}
              disabled={bulkUpdating}
            />

            Select all loaded
          </label>

          {selectedIds.size > 0 && (
            <>
              <span>{selectedIds.size} selected</span>
              {STATUSES.map((s) => (
                <button
                  key={s}
                  onClick={() => {
                    void applyBulkStatus(s);
                  }}
                  disabled={bulkUpdating}
                >
                  {bulkUpdating
                    ? 'Updating…'
                    : `Set ${statusLabel(
                        s,
                      ).toLowerCase()}`}
                </button>
              ))}

              {retryableIds.size > 0 &&
                retryStatus && (
                  <button
                    onClick={() => {
                      void applyBulkStatus(
                        retryStatus,
                        [...retryableIds],
                      );
                    }}
                    disabled={bulkUpdating}
                  >
                    Retry failed (
                    {retryableIds.size})
                  </button>
                )}

              <button
                onClick={() => {
                  if (bulkUpdating) {
                    return;
                  }

                  setSelectedIds(
                    new Set(),
                  );
                  setLastSelectedId(null);
                  setRetryableIds(
                    new Set(),
                  );
                  setRetryStatus(null);
                }}
                disabled={bulkUpdating}
              >
                Clear selection
              </button>
            </>
          )}
        </div>
      )}

      {notice && <p className="notice">{notice}</p>}

      <main className="content">
        {loading ? (
          <div className="state-message" role="status">
            Loading assets…
          </div>
        ) : error ? (
          <div className="state-message error" role="alert">
            Couldn’t load assets. {error}
          </div>
        ) : (
          <AssetGrid
            assets={items}
            selectedIds={selectedIds}
            activeId={activeId}
            onToggleSelect={toggleSelect}
            onOpen={setActiveId}
            scrollRef={scrollRef}
            loadingMore={loadingMore}
          />
        )}

        {activeId && (
          <AssetDetail id={activeId} onClose={() => setActiveId(null)} onSaved={handleSaved} />
        )}
      </main>
    </div>
  );
}
