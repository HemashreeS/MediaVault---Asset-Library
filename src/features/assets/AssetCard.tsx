import { memo, useState, type KeyboardEvent } from 'react';
import { thumbnailUrl } from '@/api/client';
import { formatBytes, formatDate, statusLabel } from '@/lib/format';
import type { Asset } from '@/lib/types';

interface Props {
    asset: Asset;
    selected: boolean;
    active: boolean;
    tabIndex: number;
    onFocus: (id: string) => void;
    onToggleSelect: (id: string, shiftKey?: boolean) => void;
    onOpen: (id: string) => void;
    onKeyDown: (event: KeyboardEvent<HTMLDivElement>, id: string) => void;
}

function AssetCardComponent({
    asset,
    selected,
    active,
    tabIndex,
    onFocus,
    onToggleSelect,
    onOpen,
    onKeyDown,
}: Props) {
    const [thumbnailError, setThumbnailError] = useState(false);
    const showThumbnail = asset.hasThumbnail && !thumbnailError;

    return (
        <div
            className={`card ${selected ? 'card--selected' : ''} ${active ? 'card--active' : ''
                }`}
            data-asset-id={asset.id}
            role="gridcell"
            aria-selected={selected}
            tabIndex={tabIndex}
            onFocus={() => onFocus(asset.id)}
            onKeyDown={(event) => onKeyDown(event, asset.id)}
            onClick={() => onOpen(asset.id)}
        >
            {showThumbnail ? (
                <img
                    className="card__thumb"
                    src={thumbnailUrl(asset.id)}
                    alt=""
                    loading="lazy"
                    onError={() => setThumbnailError(true)}
                />
            ) : (
                <div
                    className="card__thumb card__thumb--placeholder"
                    aria-label="Thumbnail unavailable"
                >
                    <span>Preview unavailable</span>
                </div>
            )}

            <div className="card__body">
                <div className="card__name" title={asset.name}>
                    {asset.name}
                </div>

                <div className="card__meta">
                    <span>{asset.kind}</span>
                    <span>{formatBytes(asset.sizeBytes)}</span>
                </div>

                <div className="card__meta">
                    <span>{statusLabel(asset.status)}</span>
                    <span>{formatDate(asset.updatedAt)}</span>
                </div>

                <label className="card__select">
                    <input
                        type="checkbox"
                        checked={selected}
                        aria-label={`Select ${asset.name}`}
                        onChange={(event) => {
                            onToggleSelect(
                                asset.id,
                                event.nativeEvent instanceof MouseEvent
                                    ? event.nativeEvent.shiftKey
                                    : false,
                            );
                        }}
                        onClick={(event) => {
                            event.stopPropagation();
                        }}
                    />
                    Select
                </label>
            </div>
        </div>
    );
}

export const AssetCard = memo(AssetCardComponent);