import type { Asset, AssetPage, AssetQuery, BulkResult } from '@/lib/types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? '';

function apiUrl(path: string): string {
  return `${API_BASE_URL}${path}`;
}

/**
 * Baseline client. It works on a good network and falls apart on a bad one.
 *
 * Known gaps, all of which are yours to close:
 *   - no request cancellation
 *   - no retry, no backoff, no handling of Retry-After
 *   - no de-duplication of concurrent identical requests
 *   - error information is flattened into a string
 *   - callers cannot distinguish "retry this" from "do not retry this"
 */

export class ApiError extends Error {
  status: number;
  code: string | null;
  retryAfterMs: number | null;

  constructor(
    status: number,
    code: string | null,
    message: string,
    retryAfterMs: number | null = null,
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.retryAfterMs = retryAfterMs;
  }
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 5_000;

function isRetryableStatus(status: number): boolean {
  return status === 429 || status === 503;
}

function parseRetryAfter(
  value: string | null,
): number | null {
  if (!value) {
    return null;
  }

  const seconds = Number(value);

  if (
    Number.isFinite(seconds) &&
    seconds >= 0
  ) {
    return seconds * 1000;
  }

  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    return null;
  }

  return Math.max(0, timestamp - Date.now());
}

function getBackoffDelay(
  retryIndex: number,
): number {
  const exponentialDelay = Math.min(
    MAX_DELAY_MS,
    BASE_DELAY_MS *
    2 ** retryIndex,
  );

  const jitter = Math.random() * exponentialDelay;

  return Math.min(
    MAX_DELAY_MS,
    exponentialDelay / 2 + jitter / 2,
  );
}

function sleep(
  delayMs: number,
  signal?: AbortSignal | null,
): Promise<void> {
  if (delayMs <= 0) {
    return Promise.resolve();
  }

  return new Promise(
    (resolve, reject) => {
      const timeout = window.setTimeout(
        resolve,
        delayMs,
      );

      if (!signal) {
        return;
      }

      if (signal.aborted) {
        window.clearTimeout(timeout);
        reject(
          new DOMException(
            'The request was aborted.',
            'AbortError',
          ),
        );
        return;
      }

      const handleAbort = () => {
        window.clearTimeout(timeout);
        signal.removeEventListener(
          'abort',
          handleAbort,
        );

        reject(
          new DOMException(
            'The request was aborted.',
            'AbortError',
          ),
        );
      };

      signal.addEventListener(
        'abort',
        handleAbort,
        { once: true },
      );
    },
  );
}

function createNetworkError(
  error: unknown,
): Error {
  if (error instanceof Error) {
    return error;
  }

  return new Error(
    'Network request failed.',
  );
}

async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const signal = init?.signal;

  for (
    let attempt = 0;
    attempt < MAX_ATTEMPTS;
    attempt += 1
  ) {
    try {
      const res = await fetch(path, {
        ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
      });
      if (!res.ok) {
        let code: string | null = null;
        let detail = res.statusText;
        try {
          const body = await res.json();
      code = body?.error?.code ?? null;
      detail = body?.error?.message ?? detail;
        } catch {
          // Response was not JSON.
        }

        const retryAfterMs =
          parseRetryAfter(
            res.headers.get(
              'Retry-After',
            ),
          );

        const error = new ApiError(
          res.status,
          code,
          detail,
          retryAfterMs,
        );

        const canRetry =
          isRetryableStatus(
            res.status,
          ) &&
          attempt <
          MAX_ATTEMPTS - 1;

        if (!canRetry) {
          throw error;
        }

        const delay =
          retryAfterMs ??
          getBackoffDelay(attempt);

        await sleep(
          delay,
          signal,
        );

        continue;
      }

      return (await res.json()) as T;
    } catch (error) {
      if (
        error instanceof DOMException &&
        error.name === 'AbortError'
      ) {
        throw error;
      }

      if (
        error instanceof ApiError
      ) {
        throw error;
      }

      const networkError =
        createNetworkError(error);

      const canRetry =
        attempt <
        MAX_ATTEMPTS - 1;

      if (!canRetry) {
        throw networkError;
      }

      const delay =
        getBackoffDelay(attempt);

      await sleep(
        delay,
        signal,
      );
    }
  }

  throw new Error(
    'Request failed after maximum retry attempts.',
  );
}

function toSearchParams(
  query: AssetQuery,
): string {
  const params =
    new URLSearchParams();

  if (query.q) {
    params.set('q', query.q);
  }

  if (query.status?.length) {
    params.set(
      'status',
      query.status.join(','),
    );
  }

  if (query.kind?.length) {
    params.set(
      'kind',
      query.kind.join(','),
    );
  }

  if (query.tag?.length) {
    params.set(
      'tag',
      query.tag.join(','),
    );
  }

  if (query.collectionId) {
    params.set(
      'collectionId',
      query.collectionId,
    );
  }

  if (query.owner) {
    params.set(
      'owner',
      query.owner,
    );
  }

  if (query.sort) {
    params.set(
      'sort',
      query.sort,
    );
  }

  if (query.limit) {
    params.set(
      'limit',
      String(query.limit),
    );
  }

  if (query.cursor) {
    params.set(
      'cursor',
      query.cursor,
    );
  }

  return params.toString();
}

export function listAssets(
  query: AssetQuery,
  signal?: AbortSignal,
): Promise<AssetPage> {
  return request<AssetPage>(
    apiUrl(`/api/assets?${toSearchParams(query)}`),
    { signal },
  );
}

export function getAsset(id: string): Promise<Asset> {
  return request<Asset>(apiUrl(`/api/assets/${id}`));
}

export function getAssetsByIds(
  ids: string[],
): Promise<{
  items: Asset[];
  missing: string[];
}> {
  return request(
    apiUrl(`/api/assets/batch?ids=${ids.join(',')}`),
  );
}

export function updateAsset(
  id: string,
  version: number,
  patch: Partial<Pick<Asset, 'name' | 'status' | 'tags'>>,
): Promise<Asset> {
  return request<Asset>(apiUrl(`/api/assets/${id}`), {
      method: 'PATCH',
    body: JSON.stringify({ version, patch }),
  });
}

export function bulkSetStatus(
  ids: string[],
  status: Asset['status'],
): Promise<BulkResult> {
  return request<BulkResult>(
    apiUrl('/api/assets/bulk-status'),
    {
      method: 'POST',
      body: JSON.stringify({
        ids,
        status,
      }),
    },
  );
}

export const thumbnailUrl = (id: string) => apiUrl(`/api/thumb/${id}.svg`);
