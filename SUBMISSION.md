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
- Task 3 - ~9 hrs
- Task 4 - ~6 hrs
- Task 5 - ~4 hrs
- Task 6 - ~3 hrs

---

## Baseline defects found

| # | Defect | Where | Fixed / left / out of scope |
| --- | --- | --- | --- |
| 1 | Bulk update sends >50 ids in one call | `App.tsx` | Fixed |
| 2 | In-flight requests are not cancelled or deduplicated | `useAssets.ts`, `api/client.ts` | Fixed |
| 3 | Query state and cursor are not synchronized/reset correctly | `useAssets.ts`, `useAssetUrlQuery.ts` | Fixed |
| 4 | Thumbnail loading/failure is not handled efficiently | `AssetCard.tsx`, `AssetDetail.tsx` | Fixed |
| 5 | All loaded assets are rendered without virtualization | `AssetGrid.tsx` | Fixed |
| 6 | Search requests are fired on every keystroke | `App.tsx`, `useAssets.ts` | Fixed |
| 7 | Cursor pagination is not implemented; the frontend only loads the initial 24 assets despite receiving nextCursor | `useAssets.ts` | Fixed |
| 8 | Keyboard navigation, focus management and screen-reader feedback are missing | `AssetGrid.tsx`, `AssetCard.tsx`, `AssetDetail.tsx`, | Fixed |
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

- Bulk status changes update the React Query asset cache immediately, before the server confirms the operation.
- Selected IDs are split into chunks of 50 to respect the API limit.
- Chunks are processed with bounded concurrency rather than firing one request per asset or all chunks simultaneously.
- A concurrency limit of 3 was used to balance throughput against the API's rate-limited environment.
- The previous asset state is captured before the optimistic update so individual failures can be rolled back without reverting successful changes.
- Successful assets keep the new status and are replaced with the authoritative server response; failed assets are restored from the pre-update snapshot; the user is told which assets failed and the reason.
- legal_hold failures are treated as permanent and are not offered for retry.
- Random conflict failures and whole-request failures are treated as retryable, so only the failed subset is retried.
- Successful assets are never unnecessarily retried or rolled back.

**Retry and backoff policy**

- Retry logic is centralized in api/client.ts rather than being duplicated across individual queries and mutations.
- Transient 429 and 503 responses are retried up to 3 total attempts.
- Retry-After is parsed from the server response and takes precedence over client-side delay calculation.
- When Retry-After is not supplied, retries use exponential backoff with jitter, capped at 5 seconds.
- Network failures are also retried, while aborted requests are allowed to terminate immediately.
400, 409, and 422 errors are structurally represented as ApiError instances and are not retried.
- This distinction prevents validation errors and version conflicts from being incorrectly treated as transient failures.
- The UI maps structured errors to actionable messages rather than exposing raw server responses.

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
The asset list uses a keyboard-oriented grid model with roving tabIndex. Users can move between cards with the arrow keys, press Enter to open the focused asset, and press Space to toggle selection. Opening the detail view transfers focus appropriately, Escape closes it, and focus returns to the triggering asset. Relevant loading, error, bulk-operation and connectivity states are exposed through live/status regions.

- How you tested it, including any screen reader.
Testing was performed using keyboard-only interaction, including moving through the grid, opening/closing the detail view, selecting assets, and checking focus behavior. Also by NVDA checked the live voice. 

- Known gaps.
Known gap is I did not complete a dedicated screen-reader test pass, so screen-reader-specific behavior is a known validation gap rather than something I am claiming as fully verified.

---

## Interface decisions

Three or four sentences: what you were optimising for, and the decisions that
follow from it. Then briefly:

The interface was kept intentionally restrained, with a small set of reusable colour, spacing and typography tokens defined in styles.css and applied consistently across the application. Asset cards give the name, selection state and status clear visual hierarchy, while the four statuses use consistent text labels and status treatments rather than relying on colour alone. Loading, empty, error, offline and partial-failure states provide clear feedback and actionable next steps without adding unnecessary visual decoration. Text contrast was checked using the WAVE Chrome extension, which reported no contrast issues.

- **Visual system.** Your colour, spacing and type decisions, and where they live.

Colour, spacing and typography are centralized in styles.css, including shared tokens for primary text, muted text, borders, backgrounds, accent, danger and asset-status treatments.

- **Status treatment.** How the four statuses read as a progression, and how they
  stay distinguishable without relying on colour.

Draft, In Review, Approved and Archived use consistent status pills with visible text labels, so their meaning does not depend on colour alone.

- **States.** What you did with loading, empty, error, offline and partial
  failure.

Loading, empty, error, offline, loading-more and partial bulk-failure states provide recognizable feedback and tell the user what is happening or what action is available.

- **Contrast.** What you checked against, and with what.

Checked the rendered interface using the WAVE Chrome extension; no contrast issues were reported.

- **Copy.** 

Replaced raw/ambiguous error presentation with user-facing messages that explain the problem more clearly, including actionable bulk-update and loading errors.

Screenshots in the repo are welcome — link them here.

---

## Trade-offs and cuts

What you deliberately did not do, and what you would do with another day.
- I prioritized cursor pagination, virtualization, lazy thumbnail loading and render optimization before adding more UI features. The goal was to make the asset list reliable at scale rather than optimize only the initial viewport.
- I did not attempt to eliminate intentional 503 failures at the infinite-scroll layer. Retry and backoff belong in the API/query resilience layer and are planned for the resilience task.
- I did not change the server or API contract.
- I did not implement an offline write queue. This was intentionally left as a bonus because replaying writes safely would require additional conflict-resolution semantics.
- I did not retry 400, 409, or 422 responses because these represent client/business-state problems rather than transient transport failures.
- I did not automatically overwrite a newer asset after a 409 version conflict. The latest server state is loaded and the user is asked to review and reapply the change.

## Critique of the API

- List errors expose useful error codes and `Retry-After`, but the frontend client currently reduces errors to a generic `Error`, so structured error handling is required on the client. 
- One limitation is that the bulk status endpoint does not accept per-asset versions, so a stale bulk client cannot detect the same version-conflict condition as a single-asset edit.
- The frontend now preserves these structured errors through an ApiError rather than reducing every failure to a generic Error.
- The API's transient failures are useful for testing resilience, but they require the client to distinguish retryable transport failures from validation and business-rule failures.

## Anything you would like us to look at

- The search pipeline and request cancellation/deduplication implemented with TanStack Query.
- The decision to debounce search by 300ms and use URL-based query state.
- The separation between cursor pagination and row virtualization for the asset grid.
- The `AssetCard` memoization and thumbnail fallback behavior.
- The bulk optimistic-update flow, including 50-ID chunking and bounded concurrency.
- The 207 partial-success handling and per-asset rollback behavior.
- The distinction between permanent legal_hold failures and retryable transient failures.
- The single-asset 409 version_conflict handling and the decision to load the latest server version instead of automatically overwriting it.
- The centralized retry policy for 429, 503 and network failures, including Retry-After and exponential backoff with jitter.
- The offline handling and automatic recovery when connectivity returns.
- The single-asset 409 version_conflict handling and the decision to load the latest server version instead of automatically overwriting it.
- The application-level ErrorBoundary and recovery actions for unexpected component failures.
- Accessibility is implemented.
