function parsePort(value, fallback) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65_535
    ? parsed
    : fallback;
}

function parsePositiveInteger(value, fallback) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export const env = {
  port: parsePort(process.env.PORT, 3000),
  frontendPort: parsePort(process.env.FRONTEND_PORT, 4000),

  pokemonListCacheKey: process.env.POKEMON_LIST_CACHE_KEY ?? "pokemons:all",

  cacheFreshTtlMs: parsePositiveInteger(process.env.CACHE_FRESH_TTL_MS, 60_000),

  cacheStaleTtlMs: parsePositiveInteger(
    process.env.CACHE_STALE_TTL_MS,
    300_000,
  ),
};

if (env.cacheStaleTtlMs <= env.cacheFreshTtlMs) {
  throw new Error("CACHE_STALE_TTL_MS must be greater than CACHE_FRESH_TTL_MS");
}
