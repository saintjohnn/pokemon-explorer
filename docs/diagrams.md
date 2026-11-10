# Diagrams

The diagrams below describe the current implementation and its Vercel deployment topology.

## 1. Deployment architecture

```mermaid
flowchart LR
    Browser[Browser]
    CDN[Vercel CDN]
    Frontend[Vercel Frontend Function<br/>Express + Handlebars]
    Backend[Vercel Backend Function<br/>Express JSON API]
    PokeAPI[PokéAPI]

    Browser -->|HTML pages and same-origin /api requests| Frontend
    Browser -->|/css, /javascript, /icons| CDN
    Frontend -->|HTTPS requests using BACKEND_URL| Backend
    Backend -->|HTTPS fetch| PokeAPI
```

## 2. Server-rendered catalogue request

```mermaid
sequenceDiagram
    participant B as Browser
    participant F as Frontend Express
    participant API as Backend Express
    participant S as PokemonService
    participant P as PokéAPI

    B->>F: GET /?page=2
    F->>F: parsePage(2)
    F->>F: Calculate offset (page - 1) * 50
    F->>API: GET /pokemons?limit=50&offset=50
    API->>S: getPokemons({ limit, offset })
    S->>S: Check page cache
    alt Cache is fresh
        S-->>API: Cached page
    else Cache is stale
        S-->>API: Stale page
        S-)S: Start single-flight background refresh
    else Cache is absent or expired
        S->>P: Fetch list and Pokémon records
        P-->>S: PokéAPI JSON
        S->>S: Validate, map, and cache
        S-->>API: Page result
    end
    API-->>F: JSON { count, results }
    F->>F: Build pagination view
    F->>F: Render home.handlebars
    F-->>B: Complete HTML response
```

## 3. Browser search request through the frontend proxy

```mermaid
sequenceDiagram
    participant B as Browser
    participant F as Frontend Express
    participant RL as Rate limiter
    participant API as Backend Express
    participant S as PokemonService
    participant P as PokéAPI

    B->>F: GET /api/pokemons/search?q=pika&limit=50&offset=0
    F->>RL: Check request count for client IP
    alt Limit exceeded
        RL-->>B: HTTP 429 JSON response
    else Within limit
        RL->>F: Continue
        F->>F: Normalize query and build URLSearchParams
        F->>API: GET /pokemons/search?q=pika&limit=50&offset=0
        API->>S: searchPokemons(query, pagination)
        S->>S: Check search-result cache
        alt Search cache hit
            S-->>API: Cached results
        else Search cache miss
            S->>P: Fetch Pokémon name list (if not cached)
            P-->>S: Name and URL list
            S->>S: Filter names and apply offset/limit
            S->>P: Fetch matching Pokémon cards in batches
            P-->>S: Pokémon records
            S->>S: Validate, map, and cache search page
            S-->>API: Search results
        end
        API-->>F: JSON response
        F-->>B: Preserve backend status and JSON body
    end
```

## 4. Single-flight lifecycle

```mermaid
sequenceDiagram
    participant A as Request A
    participant B as Request B
    participant SF as singleFlight Map
    participant U as Upstream request

    A->>SF: singleFlight(key, request)
    SF->>SF: Key not present
    SF->>U: Start request()
    SF->>SF: Store Promise by key
    B->>SF: singleFlight(same key, request)
    SF-->>B: Return existing Promise
    U-->>SF: Promise resolves or rejects
    SF->>SF: finally: delete key
    SF-->>A: Shared Promise result
    SF-->>B: Shared Promise result
```

## 5. Cache state transitions

```mermaid
stateDiagram-v2
    [*] --> Absent
    Absent --> Fetching: Cache miss
    Fetching --> Fresh: Fetch succeeds and cache entry is stored
    Fresh --> Fresh: Age < fresh TTL / return cached value
    Fresh --> Stale: Age >= fresh TTL
    Stale --> Stale: Return stale value and start background refresh
    Stale --> Fresh: Background refresh succeeds
    Stale --> Expired: Age >= stale TTL
    Expired --> Fetching: Delete old entry and await fetch
    Fetching --> Fresh: Fetch succeeds
```

The state machine is process-local. A new Vercel Function instance starts with an empty in-memory cache.

## 6. Pokémon detail page

```mermaid
sequenceDiagram
    participant B as Browser
    participant F as Frontend Express
    participant API as Backend Express
    participant S as PokemonService
    participant P as PokéAPI

    B->>F: GET /pokemons/25
    F->>API: GET /pokemons/25
    API->>S: getPokemonById(25)
    S->>P: GET /pokemon/25
    P-->>S: Pokémon payload
    S->>S: Validate Pokémon payload
    S->>P: GET species URL
    P-->>S: Species payload
    S->>S: Validate, map details, validate output
    S-->>API: Pokémon detail model
    API-->>F: JSON detail
    F->>F: Render pokemon.handlebars
    F-->>B: Complete HTML response
```
