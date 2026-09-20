import { useEffect, useState } from 'react';
import { ApiError, getAsset, thumbnailUrl, updateAsset } from '@/api/client';
import { formatBytes, formatDate, formatDuration, statusLabel } from '@/lib/format';
import type { Asset, AssetStatus } from '@/lib/types';

const STATUSES: AssetStatus[] = ['draft', 'in_review', 'approved', 'archived'];

interface Props {
  id: string;
  onClose: () => void;
  onSaved: (asset: Asset) => void;
}

/**
 * Baseline detail panel. Loads on open, saves with no optimistic update,
 * surfaces failures as raw strings, and does nothing about focus.
 */
export function AssetDetail({ id, onClose, onSaved }: Props) {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);

  useEffect(() => {
    setAsset(null);
    setError(null);
    setThumbnailError(false);
    getAsset(id)
      .then(setAsset)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : 'Load failed'));
  }, [id]);

  async function setStatus(status: AssetStatus) {
    if (!asset || saving) {
      return;
    }
    if (asset.tags.includes('legal-hold')) {
      setError('This asset is on legal hold and its status cannot be changed.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAsset(asset.id, asset.version, { status });
      setAsset(updated);
      onSaved(updated);
    } catch (err) {
      if ( err instanceof ApiError && err.code === 'version_conflict' ) {
        try {
          const latest = await getAsset(asset.id);
          setAsset(latest);
          onSaved(latest);
          setError(
            'This asset was changed by someone else. ' +
            'The latest version has been loaded. ' +
            'Please review it and apply your change again.',
          );
        } catch (refreshError) {
          setError(
            refreshError instanceof Error
              ? `The asset was changed by someone else, but the latest version could not be loaded. ${refreshError.message}`
              : 'The asset was changed by someone else, but the latest version could not be loaded.',
          );
        }
      } else {
        const message = err instanceof Error ? err.message : 'Save failed';
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  }
  const isLegalHold = asset?.tags.includes('legal-hold') ?? false;

  return (
    <aside className="panel">
      <div className="panel__head">
        <h2>Asset detail</h2>
        <button onClick={onClose} disabled={saving}>Close</button>
      </div>

      {error && (
        <p
          className="error"
          role="alert"
        >
          {error}
        </p>
      )}

      {!asset && !error && (
        <p
          className="muted"
          role="status"
        >
          Loading…
        </p>
      )}

      {asset && (
        <div className="panel__body">
          {asset.hasThumbnail && !thumbnailError ? (
            <img
              className="panel__thumb"
              src={thumbnailUrl(asset.id)}
              alt=""
              onError={() => setThumbnailError(true)}
            />
          ) : (
            <div
              className="panel__thumb panel__thumb--placeholder"
              aria-label="Thumbnail unavailable"
            >
              <span>Preview unavailable</span>
            </div>
          )}
          <h3>{asset.name}</h3>
          <dl className="facts">
            <dt>Id</dt>
            <dd>{asset.id}</dd>
            <dt>Kind</dt>
            <dd>{asset.kind}</dd>
            <dt>Size</dt>
            <dd>{formatBytes(asset.sizeBytes)}</dd>
            {asset.width && (
              <>
                <dt>Dimensions</dt>
                <dd>
                  {asset.width}×{asset.height}
                </dd>
              </>
            )}
            {asset.durationSec && (
              <>
                <dt>Duration</dt>
                <dd>{formatDuration(asset.durationSec)}</dd>
              </>
            )}
            <dt>Owner</dt>
            <dd>{asset.owner.name}</dd>
            <dt>Updated</dt>
            <dd>{formatDate(asset.updatedAt)}</dd>
            <dt>Version</dt>
            <dd>{asset.version}</dd>
          </dl>

          {asset.tags.length > 0 && (
            <ul className="tags">
              {asset.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}

          <p className="muted">Status</p>
          {isLegalHold && (
            <p className="muted" role="status">
              Status cannot be changed because this
              asset is on legal hold.
            </p>
          )}

          <div className="row">
            {STATUSES.map((status) => (
              <button
                key={status}
                disabled={saving || isLegalHold || status === asset.status}
                onClick={() => setStatus(status)}
              >
                {statusLabel(status)}
              </button>
            ))}
          </div>
        </div>
      )}
    </aside>
  );
}