# PokeNexus

A server-rendered Pokédex web application built with Node.js and Express. It provides a browsable Pokémon catalogue, name search, pagination, and detailed Pokémon pages using data from the public PokéAPI.

## Live application

- **Frontend:** [PokeNexus Hub](https://pokenexus-hub.vercel.app/)
- **Backend API:** [PokeNexus API](https://pokenexus-api.vercel.app/)

The repository is organized as two independently deployable Express applications: a frontend and a JSON backend. They communicate through the "BACKEND_URL" environment variable and run as separate processes during local development and as separate Vercel projects in production.

## Highlights

- Server-side rendered HTML pages using Express Handlebars.

- Pokémon catalogue with offset-based pagination.

- Debounced client-side search and paginated search results.

- Pokémon detail pages with descriptions, types, abilities, measurements, and stats.

- Backend data validation with Zod.

- In-memory caching, stale-while-revalidate for catalogue pages, and single-flight request deduplication.

- API rate limiting on the frontend's same-origin API proxy.

- Unit, integration, and end-to-end tests with Vitest and Supertest.

- Separate frontend and backend Vercel deployments.

## Technology stack

| Area | Technologies |
|---|---|
| Runtime | Node.js 24.x |
| HTTP applications | Express 5 |
| Server-rendered views | Express Handlebars |
| External data | PokéAPI |
| Validation | Zod |
| Caching | `Map`, `node-cache` |
| Rate limiting | `express-rate-limit` |
| Security headers | Helmet |
| Tests | Vitest, Supertest |
| Code quality | Biome |

## Features

### Pokémon catalogue

The backend requests paginated data from PokéAPI, retrieves the corresponding Pokémon records in batches, validates the external payloads, and maps them to the smaller card representation used by the frontend.

### Search

Search is case-insensitive and matches Pokémon names by substring. The backend normalizes the query and applies `limit` and `offset` to the matching collection. The browser uses a debounced search interaction and requests results through the frontend's same-origin `/api` routes.

### Pokémon details

The detail endpoint retrieves a Pokémon and its species data, validates both responses, maps them into the detail view model, and returns the result to the frontend for server-side rendering.

### Caching and request coordination

- Catalogue pages use fresh and stale time windows.

- Stale catalogue data can be returned while a background refresh is started.

- A bounded `Map` cache stores up to 500 entries and evicts the oldest inserted entry when full.

- `singleFlight` shares an in-flight Promise for requests with the same key.

- The Pokémon list used by search has a separate `node-cache` instance.

All of these caches and in-flight maps are process-local and in-memory. They are not a durable or globally shared cache across Vercel Function instances.

## Repository layout

```text

.

├── backend/

│   ├── app.js

│   ├── local-server.js

│   ├── config/

│   └── src/

│       ├── cache/

│       ├── clients/

│       ├── controllers/

│       ├── errors/

│       ├── mappers/

│       ├── middlewares/

│       ├── routes/

│       ├── schemas/

│       ├── services/

│       └── utils/

├── frontend/

│   ├── app.js

│   ├── local-server.js

│   ├── config/

│   ├── middleware/

│   ├── public/

│   │   ├── css/

│   │   ├── icons/

│   │   └── javascript/

│   ├── routes/

│   ├── utils/

│   └── views/

├── docs/

├── scripts/

├── tests/

│   ├── e2e/

│   ├── factories/

│   ├── integration/

│   └── unit/

├── .env.example

├── package.json

└── vitest.config.js

```

The frontend and backend have separate, purpose-specific environment modules. The frontend reads `BACKEND_URL`, `FRONTEND_PORT`, and `TRUST_PROXY_HOPS`; the backend reads `PORT` and its cache settings. This keeps each Vercel project's imports inside its configured Root Directory and avoids loading irrelevant environment variables.

## Dependency installation and lockfiles

The repository has three package manifests with distinct responsibilities:

- The root `package.json` contains the development, test, lint, and formatting tools used from the repository root, plus the dependencies needed to run both apps locally.

- `frontend/package.json` declares only the runtime dependencies used by the frontend deployment.

- `backend/package.json` declares only the runtime dependencies used by the backend deployment.

Each deployable directory has its own `package-lock.json`. This matters because the Vercel projects use `frontend` and `backend` as their respective Root Directories; each project can install from the manifest and lockfile inside its own root without relying on files above that directory. The root lockfile is used for local development and CI tasks run from the repository root.

After changing dependencies in one of these manifests, regenerate the matching lockfile from that directory with `npm install`, then commit both files. For example, after changing a frontend dependency, run `npm install` from `frontend/`.

## Requirements

- Node.js 24.x

- npm (the version bundled with your Node.js installation is sufficient)

- Git, if you intend to deploy through the Vercel Git integration

- A Vercel account

- Internet access for requests to PokéAPI

The Node version is declared as `24.x` in the root and deployment-specific `package.json` files. Each deployable application also has its own `package-lock.json`, so Vercel can install its dependencies reproducibly from its configured Root Directory.

## Environment configuration

### Local development

Create a root `.env` file based on `.env.example`:

```bash

cp .env.example .env

```

On Windows PowerShell:

```powershell

Copy-Item .env.example .env

```

The root `.env` is used by the root development scripts to start both servers.

| Variable | Local value / default | Purpose |
|---|---:|---|
| `NODE_ENV` | `development` | Local environment mode. |
| `PORT` | `3000` | Backend local port. |
| `FRONTEND_PORT` | `4000` | Frontend local port. |
| `BACKEND_URL` | `http://127.0.0.1:3000` | Backend base URL used by the frontend server. |
| `TRUST_PROXY_HOPS` | `0` | Number of trusted proxy hops used by Express on the frontend. |
| `POKEMON_LIST_CACHE_KEY` | `pokemons:all` | Prefix used when building catalogue-page cache keys. |
| `CACHE_FRESH_TTL_MS` | `60000` | Fresh cache window in milliseconds. |
| `CACHE_STALE_TTL_MS` | `300000` | Maximum age of a catalogue cache entry before it is expired. Must be greater than the fresh TTL. |

`PORT` and `FRONTEND_PORT` are for local `listen()` processes. Vercel invokes the exported Express application as a Function, so these port variables are not needed for deployment.

### Vercel environment variables

Create two Vercel projects from the same Git repository:

1. `pokemon-backend`, with **Root Directory** set to `backend`.

2. `pokemon-frontend`, with **Root Directory** set to `frontend`.

Configure variables in each project's **Settings → Environment Variables**. Add them separately for Preview and Production as appropriate.

#### Backend project

| Variable | Suggested production value |
|---|---|
| `POKEMON_LIST_CACHE_KEY` | `pokemons:all` |
| `CACHE_FRESH_TTL_MS` | `60000` |
| `CACHE_STALE_TTL_MS` | `300000` |

#### Frontend project

| Variable | Suggested production value |
|---|---|
| `BACKEND_URL` | The deployed backend base URL, for example `https://your-backend.vercel.app` |
| `TRUST_PROXY_HOPS` | Start with `1`, then verify client IP and rate-limit behavior in the deployed environment. |

Do not include a trailing slash in `BACKEND_URL`; the environment parser also removes trailing slashes. Do not set `BACKEND_URL` to the frontend URL.

Vercel supplies the deployment environment. `NODE_ENV`, `PORT`, and `FRONTEND_PORT` do not need to be copied from the local `.env` into Vercel. Never upload or commit `.env`; only use the Vercel dashboard or CLI to store deployment values.

The project-specific examples are available at `backend/.env.example` and `frontend/.env.example`. The root `.env.example` combines the variables needed to run both processes locally.

## Install and run locally

From the repository root:

```bash

npm ci

npm run dev

```

The two servers start concurrently:

- Frontend: `http://localhost:4000`

- Backend health check: `http://localhost:3000/health`

- Frontend health check: `http://localhost:4000/health`

The frontend uses `BACKEND_URL` to communicate with the backend. Make sure both servers are running and the URL points to the backend. The frontend `vercel.json` explicitly includes `views/**` in the Express Function bundle because Handlebars loads those templates at runtime. Static assets remain under `frontend/public/`, where Vercel serves them through its CDN.

To start only one application:

```bash

npm run dev:backend

npm run dev:frontend

```

Production-style local start commands are also available:

```bash

npm run start:backend

npm run start:frontend

```

## Tests and code checks

Run the complete test suite:

```bash

npm run test:all

```

Run the code-quality check:

```bash

npm run check

```

The repository also exposes focused commands:

```bash

npm run test:unit

npm run test:integration

npm run test:e2e

npm run lint

npm run format

```

Run `npm run test:all` and `npm run check` before every deployment. The tests use mocked external HTTP responses for deterministic behavior; a passing test suite does not replace smoke tests against the deployed Vercel URLs and the live PokéAPI.

## Operational notes and known limitations

- Vercel runs each Express application as a serverless Function rather than as a permanently listening process.

- The frontend and backend are separate deployments and communicate over HTTPS through `BACKEND_URL`.

- In-memory caches, `singleFlight` maps, and the default `express-rate-limit` memory store are scoped to a warm process/instance. They are not guaranteed to be shared across concurrent instances, regions, cold starts, or deployments.

- A background SWR refresh is best-effort in a serverless lifecycle. Do not treat the in-memory cache as durable storage or assume a background refresh survives instance suspension.

- The application uses server-side Handlebars rendering. It does not use a React/Vue-style client hydration lifecycle or a Vercel Edge Runtime.

- The current tests do not validate Vercel's CDN, project environment variables, or real deployment networking. Those require the Preview smoke tests.

## Further documentation

- [Architecture](docs/architecture.md)

- [Technical decisions](docs/technical-decisions.md)

- [Diagrams](docs/diagrams.md)

- [Vercel Express documentation](https://vercel.com/docs/frameworks/backend/express)

- [Vercel project configuration](https://vercel.com/docs/project-configuration)
