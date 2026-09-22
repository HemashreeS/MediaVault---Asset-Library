import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type Ref,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

import type { Asset } from '@/lib/types';
import { AssetCard } from './AssetCard';

interface Props {
  assets: Asset[];
  selectedIds: Set<string>;
  activeId: string | null;
  onToggleSelect: (id: string, shiftKey?: boolean) => void;
  onOpen: (id: string) => void;
  scrollRef?: Ref<HTMLDivElement>;
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

  const [focusedId, setFocusedId] = useState<string | null>(
    assets[0]?.id ?? null,
  );

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

  useEffect(() => {
    if (assets.length === 0) {
      setFocusedId(null);
      return;
    }

    const focusedStillExists =
      focusedId !== null &&
      assets.some((asset) => asset.id === focusedId);

    if (!focusedStillExists) {
      const firstAsset = assets[0];

      if (firstAsset) {
        setFocusedId(firstAsset.id);
      }
    }
  }, [assets, focusedId]);

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => gridRef.current,
    estimateSize: () => CARD_HEIGHT + GRID_GAP,
    overscan: 2,
  });

  /**
   * Move keyboard focus to another asset.
   *
   * The grid is virtualized, so the target card may not currently
   * exist in the DOM. We first ask the virtualizer to bring the
   * target row into view, then focus the card after React renders it.
   */
  const moveFocus = (targetId: string) => {
    const targetIndex = assets.findIndex(
      (asset) => asset.id === targetId,
    );

    if (targetIndex === -1) {
      return;
    }

    const targetRow = Math.floor(targetIndex / columnCount);

    setFocusedId(targetId);

    rowVirtualizer.scrollToIndex(targetRow, {
      align: 'auto',
    });

    requestAnimationFrame(() => {
      const target = gridRef.current?.querySelector<HTMLElement>(
        `[data-asset-id="${CSS.escape(targetId)}"]`,
      );

      target?.focus();
    });
  };

  const handleCardKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    id: string,
  ) => {
    const currentIndex = assets.findIndex(
      (asset) => asset.id === id,
    );

    if (currentIndex === -1) {
      return;
    }

    const currentRow = Math.floor(currentIndex / columnCount);
    const currentColumn = currentIndex % columnCount;

    let targetIndex = -1;

    switch (event.key) {
      case 'ArrowRight':
        if (currentIndex < assets.length - 1) {
          targetIndex = currentIndex + 1;
        }
        break;

      case 'ArrowLeft':
        if (currentIndex > 0) {
          targetIndex = currentIndex - 1;
        }
        break;

      case 'ArrowDown': {
        const nextIndex = currentIndex + columnCount;

        if (nextIndex < assets.length) {
          targetIndex = nextIndex;
        }
        break;
      }

      case 'ArrowUp': {
        const previousIndex = currentIndex - columnCount;

        if (previousIndex >= 0) {
          targetIndex = previousIndex;
        }
        break;
      }

      case 'Enter':
        event.preventDefault();
        onOpen(id);
        return;

      case ' ':
      case 'Spacebar':
        event.preventDefault();
        onToggleSelect(id, event.shiftKey);
        return;

      default:
        return;
    }

    if (targetIndex === -1) {
      return;
    }

    event.preventDefault();

    const targetAsset = assets[targetIndex];

    if (!targetAsset) {
      return;
    }

    moveFocus(targetAsset.id);

    void currentRow;
    void currentColumn;
  };

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
    <div
      className="grid"
      ref={setGridRef}
      role="grid"
      aria-label="Assets"
    >
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
              role="row"
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
                  tabIndex={focusedId === asset.id ? 0 : -1}
                  onFocus={setFocusedId}
                  onToggleSelect={onToggleSelect}
                  onOpen={onOpen}
                  onKeyDown={handleCardKeyDown}
                />
              ))}
            </div>
          );
        })}

        {loadingMore && (
          <div className="load-more-status" role="status">
            Loading more assets…
          </div>
        )}
      </div>
    </div>
  );
}