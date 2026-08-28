import NodeCache from "node-cache";

const pokemonCacheTtlSeconds = 30 * 24 * 60 * 60;

const pokemonCache = new NodeCache({ stdTTL: pokemonCacheTtlSeconds });

export default pokemonCache;
