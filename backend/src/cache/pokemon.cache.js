const cache = new Map();

export function getPokemonCache(key) {
  return cache.get(key);
}
 
export function setPokemonCache(key, value, now = Date.now()) {
  const entry = { value, createdAt: now };

  cache.set(key, entry);

  return entry;
}

export function deletePokemonCache(key) {
  cache.delete(key);
}

export function clearPokemonCache() {
  cache.clear();
}

// Compatibility facade for existing tests and callers that used NodeCache

const pokemonCache = {
  get(key) {
    return getPokemonCache(key)?.value;
  },

  set(key, value, _ttl) {
    setPokemonCache(key, value);

    return true;
  },

  del(key) {
    deletePokemonCache(key);
  },

  flushAll() {
    clearPokemonCache();
  },
};

export default pokemonCache;
