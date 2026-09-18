import { useCallback, useState } from 'react';
import { bulkSetStatus } from '@/api/client';
import { AssetDetail } from '@/features/assets/AssetDetail';
import { AssetGrid } from '@/features/assets/AssetGrid';
import { useAssets } from '@/features/assets/useAssets';
import { statusLabel } from '@/lib/format';
import type { Asset, AssetStatus, AssetQuery } from '@/lib/types';
import { useAssetUrlQuery } from './features/assets/useAssetUrlQuery';
import { useInfiniteScroll } from './features/assets/useInfiniteScroll';

const STATUSES: AssetStatus[] = ['draft', 'in_review', 'approved', 'archived'];
const SORTS: Array<{ value: NonNullable<AssetQuery['sort']>; label: string }> = [
  { value: 'updatedAt:desc', label: 'Recently updated' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'sizeBytes:desc', label: 'Largest first' },
  { value: 'createdAt:desc', label: 'Newest' },
];

export function App() {
  const { query: urlQuery, updateQuery } = useAssetUrlQuery();

  const q = urlQuery.q ?? '';
  const status = urlQuery.status ?? [];
  const sort = urlQuery.sort ?? 'updatedAt:desc';
  const kind = urlQuery.kind ?? [];
  const tag = urlQuery.tag ?? [];
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const { items, total, loading, error, loadingMore, hasNextPage, fetchNextPage } = useAssets({ q, status, kind, tag, sort, limit: 24 });
  const scrollRef = useInfiniteScroll({ hasNextPage, loading, loadingMore, onLoadMore: fetchNextPage });

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
  }, []);

  async function applyBulkStatus(next: AssetStatus) {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    setNotice(null);
    try {
      // Sends every selected id in one call, which the API refuses above 50.
      const result = await bulkSetStatus(ids, next);
      setNotice(`${result.applied} updated, ${result.failed} failed.`);
      setSelectedIds(new Set());
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Bulk update failed');
    }
  }

  function handleSaved(_asset: Asset) {
    // The list is not told that anything changed, so it shows stale rows.
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
        />
        <select value={sort} onChange={(e) => updateQuery({ sort: e.target.value as NonNullable<AssetQuery['sort']> })}>
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
            />
            {statusLabel(s)}
          </label>
        ))}
        <span className="muted">
          {loading ? 'Loading…' : error ? "Unable to load results..." : `${items.length} of ${total.toLocaleString()} shown`}
        </span>
      </div>

      {selectedIds.size > 0 && (
        <div className="bulkbar">
          <span>{selectedIds.size} selected</span>
          {STATUSES.map((s) => (
            <button key={s} onClick={() => applyBulkStatus(s)}>
              Set {statusLabel(s).toLowerCase()}
            </button>
          ))}
          <button onClick={() => setSelectedIds(new Set())}>Clear selection</button>
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
          <>
            <AssetGrid
              assets={items}
              selectedIds={selectedIds}
              activeId={activeId}
              onToggleSelect={toggleSelect}
              onOpen={setActiveId}
              scrollRef={scrollRef}
              loadingMore={loadingMore}
            />
          </>
        )}

        {activeId && (
          <AssetDetail id={activeId} onClose={() => setActiveId(null)} onSaved={handleSaved} />
        )}
      </main>
    </div>
  );
}
