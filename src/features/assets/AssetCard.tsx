import { memo, useState } from 'react';
import { thumbnailUrl } from '@/api/client';
import { formatBytes, formatDate, statusLabel } from '@/lib/format';
import type { Asset } from '@/lib/types';

interface Props {
    asset: Asset;
    selected: boolean;
    active: boolean;
    onToggleSelect: (id: string, shiftKey?: boolean) => void;
    onOpen: (id: string) => void;
}

function AssetCardComponent({
    asset,
    selected,
    active,
    onToggleSelect,
    onOpen,
}: Props) {
    const [thumbnailError, setThumbnailError] = useState(false);
    const showThumbnail = asset.hasThumbnail && !thumbnailError;

    return (
        <div
            className={`card ${selected ? 'card--selected' : ''} ${active ? 'card--active' : ''
            }`}
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
                        onClick={(event) => {
                            event.stopPropagation();
                            onToggleSelect(asset.id, event.shiftKey);
                        }}
                    />
                    Select
                </label>
            </div>
        </div>
    );
}

export const AssetCard = memo(AssetCardComponent);