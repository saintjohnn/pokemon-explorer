# Technical Decisions

This document describes mechanisms present in the current source code. It distinguishes process-local behavior from guarantees a multi-instance serverless deployment can provide.

## 1. Single-flight request deduplication

Implementation: `backend/src/utils/single-flight.js`.

`singleFlight(key, request)` stores the Promise for an in-progress request in a module-level `Map`:

1. It checks whether the key already has an in-flight Promise.
2. If one exists, the caller receives the same Promise rather than starting another request.
3. Otherwise, it invokes `request()`, stores the Promise, and returns it.
4. A `finally` callback deletes the key after resolution or rejection.

The PokéAPI client uses the canonical URL string as its key. The catalogue service also uses its page cache key while fetching or refreshing a page. This deduplicates concurrent same-key work within one process. It does not cache completed results by itself; the cache modules do that.

**Serverless boundary:** the `Map` is process-local. It coordinates calls only when they reach the same warm Function instance. It does not deduplicate across Vercel instances, regions, or deployments.

## 2. Cache strategy and stale-while-revalidate

Implementation:
- `backend/src/cache/pokemon.cache.js`
- `backend/src/cache/pokemon-list.cache.js`
- `backend/src/services/pokemon.service.js`

### 2.1 Catalogue page cache

The primary cache is a JavaScript `Map` with a maximum of 500 entries. Each entry contains `value` and `createdAt`. When the cache is full and a new key is inserted, the first key in Map insertion order is removed. Updating an existing key deletes and reinserts it, moving it to the newest position. This is FIFO insertion-order eviction, not access-based LRU.

The page key includes the configured list prefix, `limit`, and `offset`, so different pages have independent cache entries.

### 2.2 Fresh, stale, and expired states

The service calculates age with `Date.now() - entry.createdAt`:

| State | Condition | Behavior |
|---|---|---|
| Fresh | Age is below `CACHE_FRESH_TTL_MS` | Return cached value immediately. |
| Stale | Age is at least the fresh TTL but below `CACHE_STALE_TTL_MS` | Return stale value immediately and start a background refresh. |
| Expired | Age is at least the stale TTL | Delete the entry and wait for a new fetch. |
| Absent | No entry exists | Fetch and cache the page. |

Defaults are 60,000 ms for the fresh window and 300,000 ms for the maximum stale age. The environment parser rejects a stale TTL that is not greater than the fresh TTL.

The background refresh uses `singleFlight` with the same page key. A refresh failure is logged and does not replace the stale value with a failed result.

### 2.3 Search cache and Pokémon-list cache

Search results use a separate key containing the normalized lowercase query, `limit`, and `offset`. Search cache hits are returned directly; this search-result path does not use the catalogue page's fresh/stale state machine.

The full Pokémon name/URL list used for search is stored in a separate `node-cache` instance with a 15-day standard TTL and a 600-second check period. The PokéAPI client applies single-flight deduplication to the underlying request.

### 2.4 Serverless implications

Both cache implementations are in memory. A warm Vercel Function instance may reuse its cache, but another instance starts with a separate cache. There is no shared Redis/database cache in this repository. The SWR background refresh is best-effort in a serverless environment; the code does not use a durable queue or explicit background-task API.

## 3. Pagination

The application uses **offset-based pagination**, not cursor pagination.

The API accepts `limit` (positive integer, default `50`) and `offset` (non-negative integer, default `0`). The Zod query schema accepts digit-only strings, converts them to numbers, and validates minimum values.

The frontend uses a page number for navigation. With a page size of 50, the offset is:

```js
(page - 1) * limit
```

The backend sends `limit` and `offset` to PokéAPI. Search first filters the cached full Pokémon list by normalized name substring, then slices the matching array with `matches.slice(offset, offset + limit)`.

Offset pagination is straightforward for this catalogue and matches the upstream PokéAPI contract. The current implementation does not use cursors or opaque continuation tokens.

## 4. Rate limiting

Implementation: `frontend/middleware/rate-limit.js`.

`createApiLimiter()` wraps `express-rate-limit` with these defaults:

- 100 requests per 15 minutes.
- Standard rate-limit headers enabled.
- Legacy `X-RateLimit-*` headers disabled.
- A JSON response message configured for clients that exceed the limit.

The limiter is attached to the frontend's `/api/pokemons` and `/api/pokemons/search` proxy routes. The browser calls the frontend origin, and the frontend applies the limit before forwarding requests to the backend.

The code uses the library's default in-memory store; no Redis or database store is configured. On Vercel, counters are consequently per process/instance and are not globally shared. Correct client IP detection also depends on `TRUST_PROXY_HOPS` matching the deployed proxy chain. Verify this in Preview before relying on the limit as a global abuse-control boundary.

When the configured threshold is exceeded, the middleware responds with HTTP 429 and the configured JSON message.

## 5. Server-side rendering (SSR)

Implementation:
- `frontend/routes/pokemon.routes.js`
- `frontend/views/layouts/main.handlebars`
- `frontend/views/home.handlebars`
- `frontend/views/pokemon.handlebars`

### 5.1 Catalogue request

1. Express receives `GET /` or `GET /?page=N`.
2. `parsePage` converts an invalid or missing page to page 1.
3. `getOffsetForPage` calculates the offset.
4. `fetchPokemonPage` requests the backend with a 10-second `AbortSignal.timeout`.
5. A non-success backend status becomes an error passed to Express error handling.
6. The frontend calculates pagination metadata and calls `res.render("home", ...)`.
7. Handlebars renders the layout, header/footer partials, Pokémon cards, and pagination markup into HTML.

### 5.2 Detail request

1. Express receives `GET /pokemons/:id`.
2. The frontend requests the backend detail endpoint with a 10-second timeout.
3. Backend 400/404 responses are rendered as the frontend not-found page.
4. Other unsuccessful statuses are forwarded as errors.
5. A successful JSON detail response is passed to `res.render("pokemon", ...)`.

### 5.3 Browser enhancement

The browser receives rendered HTML containing the initial content. It then loads `public/javascript/app.js` as a JavaScript module. That script adds interactive search and pagination behavior.

There is no React/Vue hydration lifecycle, client-side component tree, or serialized hydration payload in this project. The accurate description is server-side Handlebars rendering followed by client-side progressive enhancement.

### 5.4 Vercel runtime

The frontend Express app is exported from `frontend/app.js` and discovered by Vercel because the project Root Directory is `frontend`. Vercel runs it as a Node.js Function. The backend project similarly exports `backend/app.js` as its own Function.

Vercel's static asset delivery is separate from Express request handling: `frontend/public/**` is served by the Vercel CDN. The `express.static()` middleware is retained for local development and is not relied on for deployed assets.

The project does not configure the Edge Runtime. SSR executes in the Node.js Function.

## 6. Upstream request safety and error handling

The PokéAPI client:
- Builds URLs against `https://pokeapi.co/api/v2/`.
- Restricts accepted URLs to the PokéAPI origin and API path.
- Rejects redirects.
- Applies a 10-second timeout.
- Converts non-2xx upstream responses into a `PokeApiError` (HTTP 502 in the backend API).

The backend validates request parameters and external response payloads with Zod before mapping them. Known application errors are serialized by the application error middleware; unexpected errors continue to the internal-server-error handler.

## 7. Summary of guarantees and non-guarantees

| Mechanism | Guaranteed by this code | Not guaranteed by this code |
|---|---|---|
| Single-flight | Same-key in-flight Promise sharing in one process | Cross-instance deduplication |
| SWR | Fresh/stale/expired decisions in one process | Durable cache or guaranteed background completion after response |
| Cache | Up to 500 primary cache entries per process | Shared/global cache across Functions |
| Rate limiting | Per-process request counting on frontend proxy routes | Global quota across all instances |
| SSR | Handlebars HTML generated before response | React/Vue hydration or Edge rendering |
| Pagination | `limit` + `offset` contract | Cursor pagination |
