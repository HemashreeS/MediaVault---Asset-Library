import { useCallback, useEffect, useState } from 'react';
import type { AssetKind, AssetQuery, AssetStatus } from '@/lib/types';

const DEFAULT_SORT: NonNullable<AssetQuery['sort']> = 'updatedAt:desc';

const VALID_STATUSES: AssetStatus[] = [
    'draft',
    'in_review',
    'approved',
    'archived',
];

const VALID_KINDS: AssetKind[] = ['image', 'video', 'document'];

function readQueryFromUrl(): Pick<AssetQuery, 'q' | 'status' | 'kind' | 'tag' | 'sort'> {
    const params = new URLSearchParams(window.location.search);

    const q = params.get('q') ?? '';

    const status = params
        .getAll('status')
        .filter((value): value is AssetStatus =>
            VALID_STATUSES.includes(value as AssetStatus),
        );

    const kind = params
        .getAll('kind')
        .filter((value): value is AssetKind =>
            VALID_KINDS.includes(value as AssetKind),
        );

    const tag = params.getAll('tag');

    const sortParam = params.get('sort');

    const sort =
        sortParam === 'updatedAt:desc' ||
            sortParam === 'name:asc' ||
            sortParam === 'sizeBytes:desc' ||
            sortParam === 'createdAt:desc'
            ? sortParam
            : DEFAULT_SORT;

    return {
        q,
        status,
        kind,
        tag,
        sort,
    };
}

function writeQueryToUrl(query: Pick<AssetQuery, 'q' | 'status' | 'kind' | 'tag' | 'sort'>) {
    const params = new URLSearchParams();

    if (query.q?.trim()) {
        params.set('q', query.q);
    }

    for (const value of query.status ?? []) {
        params.append('status', value);
    }

    for (const value of query.kind ?? []) {
        params.append('kind', value);
    }

    for (const value of query.tag ?? []) {
        params.append('tag', value);
    }

    if (query.sort && query.sort !== DEFAULT_SORT) {
        params.set('sort', query.sort);
    }

    const search = params.toString();
    const url = search
        ? `${window.location.pathname}?${search}`
        : window.location.pathname;

    window.history.replaceState(null, '', url);
}

export function useAssetUrlQuery() {
    const [query, setQuery] = useState(readQueryFromUrl);

    useEffect(() => {
        function handlePopState() {
            setQuery(readQueryFromUrl());
        }

        window.addEventListener('popstate', handlePopState);

        return () => {
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    const updateQuery = useCallback(
        (next: Partial<Pick<AssetQuery, 'q' | 'status' | 'kind' | 'tag' | 'sort'>>) => {
            const updated = {
                ...query,
                ...next,
            };

            writeQueryToUrl(updated);
            setQuery(updated);
        },
        [query],
    );

    return {
        query,
        updateQuery,
    };
}