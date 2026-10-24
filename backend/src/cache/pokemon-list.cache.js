import NodeCache from "node-cache"

const pokemonListCache = new NodeCache({
	stdTTL: 1296000,
	checkperiod: 600,
})

export default pokemonListCache
