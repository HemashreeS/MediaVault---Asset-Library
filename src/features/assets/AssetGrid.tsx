import { useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import type { Asset } from '@/lib/types';
import { AssetCard } from './AssetCard';

interface Props {
  assets: Asset[];
  selectedIds: Set<string>;
  activeId: string | null;
  onToggleSelect: (id: string, shiftKey?: boolean) => void;
  onOpen: (id: string) => void;
  scrollRef?: React.Ref<HTMLDivElement>;
  loadingMore?: boolean;
}

const CARD_MIN_WIDTH = 220;
const GRID_GAP = 12;
const CARD_HEIGHT = 240;

export function AssetGrid({
  assets,
  selectedIds,
  activeId,
  onToggleSelect,
  onOpen,
  scrollRef,
  loadingMore = false,
}: Props) {
  const gridRef = useRef<HTMLDivElement | null>(null);

  const setGridRef = (node: HTMLDivElement | null) => {
    gridRef.current = node;

    if (typeof scrollRef === 'function') {
      scrollRef(node);
    }
  };

  const [columnCount, setColumnCount] = useState(1);

  useEffect(() => {
    const element = gridRef.current;

    if (!element) {
      return;
    }

    const updateColumns = () => {
      const styles = getComputedStyle(element);
      const paddingLeft = parseFloat(styles.paddingLeft);
      const paddingRight = parseFloat(styles.paddingRight);

      const contentWidth =
        element.clientWidth - paddingLeft - paddingRight;

      const columns = Math.max(
        1,
        Math.floor(
          (contentWidth + GRID_GAP) /
          (CARD_MIN_WIDTH + GRID_GAP),
        ),
      );

      setColumnCount(columns);
    };

    updateColumns();

    const observer = new ResizeObserver(updateColumns);
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => {
    const result: Asset[][] = [];

    for (let i = 0; i < assets.length; i += columnCount) {
      result.push(assets.slice(i, i + columnCount));
    }

    return result;
  }, [assets, columnCount]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => gridRef.current,
    estimateSize: () => CARD_HEIGHT + GRID_GAP,
    overscan: 2,
  });

  if (assets.length === 0) {
    return (
      <div className="empty">
        <p>Nothing matches these filters.</p>
        <p className="muted">
          Clear the search box or widen the status filter.
        </p>
      </div>
    );
  }

  return (
    <div className="grid" ref={setGridRef}>
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const row = rows[virtualRow.index];

          if (!row) {
            return null;
          }

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={rowVirtualizer.measureElement}
              className="asset-row"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
                display: 'grid',
                gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))`,
                gap: GRID_GAP,
              }}
            >
              {row.map((asset) => (
                <AssetCard
                  key={asset.id}
                  asset={asset}
                  selected={selectedIds.has(asset.id)}
                  active={activeId === asset.id}
                  onToggleSelect={onToggleSelect}
                  onOpen={onOpen}
                />
              ))}
            </div>
          );
        })}

        {loadingMore && (
          <div
            className="load-more-status"
            role="status"
          >
            Loading more assets…
          </div>
        )}
      </div>
    </div>
  );
}