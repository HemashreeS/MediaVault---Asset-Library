# Submission

Keep this tight. Bullet points are fine. We read this before we read your code,
and a clear account of your reasoning carries real weight — including where you
chose not to do something.

## Video walkthrough

Paste your Loom (or equivalent) link here. 5–10 minutes.

**Link:**

---

## How to run it

Anything we need to know beyond `npm install && npm run dev`.

## Time spent

- Task 0 — ~1 hr
- Task 1 — ~3 hrs
- Task 2 - ~6 hrs

---

## Baseline defects found

| # | Defect | Where | Fixed / left / out of scope |
| --- | --- | --- | --- |
| 1 | Bulk update sends >50 ids in one call | `App.tsx` | |
| 2 | In-flight requests are not cancelled or deduplicated | `useAssets.ts`, `api/client.ts` | Fixed |
| 3 | Query state and cursor are not synchronized/reset correctly | `useAssets.ts`, `useAssetUrlQuery.ts` | Fixed |
| 4 | Thumbnail loading/failure is not handled efficiently | `AssetCard.tsx`, `AssetDetail.tsx` | Fixed |
| 5 | All loaded assets are rendered without virtualization | `AssetGrid.tsx` | Fixed |
| 6 | Search requests are fired on every keystroke | `App.tsx`, `useAssets.ts` | Fixed |
| 7 | Cursor pagination is not implemented; the frontend only loads the initial 24 assets despite receiving nextCursor | `useAssets.ts` | Fixed |
| 8 | Keyboard navigation, focus management and screen-reader feedback are missing | | |
| 9 | Asset card content is clipped because the card uses overflow: hidden with the current layout | `styles.css` | Fixed |

---

## Key decisions

For each significant choice: what you did, what you rejected, and why. Three to
six of these is about right.

**Data fetching and caching**

- Chose TanStack Query instead of maintaining request state manually.
- It provides query-key based caching and deduplication, cancellation through `AbortSignal`, and a natural path to cursor pagination and mutations in later tasks.
- Set a 30-second `staleTime` and disabled automatic window-focus refetching to avoid unnecessary requests against the intentionally rate-limited API.
- Search queries currently disable automatic retries; retry/backoff will be handled explicitly as part of resilience work.

**Stale response handling**

- Search input uses a 300ms debounce to avoid sending a request for every keystroke during ordinary typing.
- TanStack Query provides an `AbortSignal` to the query function, which is passed through to `fetch`.
- When the query changes, obsolete requests are cancelled rather than merely ignored.
- This prevents a slower response for an earlier query such as `tra` from replacing the results for a newer query.

**Virtualization approach**

- Chose row virtualization with `@tanstack/react-virtual` rather than rendering every loaded asset.
- Virtualization is applied at the row level so the responsive multi-column grid can still adapt between different viewport widths.
- Used a small overscan value to keep scrolling visually smooth without creating a large DOM.
- Kept cursor pagination separate from virtualization: pagination controls how many assets are loaded, while virtualization controls how many loaded assets are mounted.
- Measured the result during scrolling and observed approximately 35 rendered cards while approximately 350 assets had been loaded.

**Optimistic updates and rollback**

**Retry and backoff policy**

**State placement and URL sync**

- Search query, selected statuses and sort order are stored in the URL so the view can be refreshed or shared without losing the current query.
- `history.replaceState` is used for query changes so typing does not create one browser-history entry per character.
- Browser `popstate` is handled to restore URL state when navigating with Back/Forward.
- Pagination/cursor state will remain query-controlled rather than being persisted as an independent URL value, so changing filters starts a new query.

---

## Performance

Fill in real measurements, not estimates. Say which machine and browser.

| Metric | Before | After | How measured |
| --- | --- | --- | --- |
| Rendered DOM nodes at 5,000 rows loaded | all cards | ~35 cards for ~350 assets loaded | document.querySelectorAll('.grid .card').length |
| Cards re-rendered when toggling one selection | Many visible cards | 1-2 affected cards | Temporary React.memo comparator + render logging |
| Longest task during sustained scroll | - | 29.39 ms | Chrome DevTools Performance recording while scrolling |
| Requests fired while typing a 6-character query | 6 api calls | 1 api call | Chrome DevTools Network|
| Production bundle, gzipped | | | |

What was the actual bottleneck, and how did you find it?
The main bottlenecks were unnecessary rendering of the growing asset list and rendering all loaded cards directly into the DOM. The baseline grid rendered every loaded asset, while selection changes also caused the card tree to re-render through the parent. I addressed this with cursor-based infinite pagination, row virtualization, debounced/cancellable search, and memoized AssetCard components. Chrome DevTools measurements after the changes showed ~35 rendered cards with ~350 assets loaded and a longest observed scroll task of 29.39 ms.

---

## Accessibility

- Keyboard model you implemented, in one paragraph.
- How you tested it, including any screen reader.
- Known gaps.

---

## Interface decisions

Three or four sentences: what you were optimising for, and the decisions that
follow from it. Then briefly:

- **Visual system.** Your colour, spacing and type decisions, and where they live.
- **Status treatment.** How the four statuses read as a progression, and how they
  stay distinguishable without relying on colour.
- **States.** What you did with loading, empty, error, offline and partial
  failure.
- **Contrast.** What you checked against, and with what.
- **Copy.** Replaced the ambiguous error behavior with distinct messages `Couldn't load assets.`.

Screenshots in the repo are welcome — link them here.

---

## Trade-offs and cuts

What you deliberately did not do, and what you would do with another day.
- I prioritized cursor pagination, virtualization, lazy thumbnail loading and render optimization before adding more UI features. The goal was to make the asset list reliable at scale rather than optimize only the initial viewport.
- I did not attempt to eliminate intentional 503 failures at the infinite-scroll layer. Retry and backoff belong in the API/query resilience layer and are planned for the resilience task.
- I did not change the server or API contract.

## Critique of the API

- List errors expose useful error codes and `Retry-After`, but the frontend client currently reduces errors to a generic `Error`, so structured error handling is required on the client. 

## Anything you would like us to look at

- The search pipeline and request cancellation/deduplication implemented with TanStack Query.
- The decision to debounce search by 300ms and use URL-based query state.
- The separation between cursor pagination and row virtualization for the asset grid.
- The `AssetCard` memoization and thumbnail fallback behavior.
