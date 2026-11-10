import {
	clearPokemonCache,
	getPokemonCache,
	setPokemonCache,
} from "../../../backend/src/cache/pokemon.cache.js"

describe("Pokemon cache", () => {
	beforeEach(() => {
		clearPokemonCache()
	})

	it("should store and retrieve an entry with its creation timestamp", () => {
		// Arrange
		const value = { results: [] }
		const now = 1_700_000_000_000

		// Act
		const entry = setPokemonCache("pokemons", value, now)

		// Assert
		expect(getPokemonCache("pokemons")).toBe(entry)
		expect(entry).toStrictEqual({ value, createdAt: now })
	})

	it("should evict the oldest entry when the cache reaches its maximum size", () => {
		// Arrange
		for (let index = 0; index < 500; index++) {
			setPokemonCache(`pokemon:${index}`, index)
		}

		// Act
		setPokemonCache("pokemon:new", "new")

		// Assert
		expect(getPokemonCache("pokemon:0")).toBeUndefined()
		expect(getPokemonCache("pokemon:1").value).toBe(1)
		expect(getPokemonCache("pokemon:new").value).toBe("new")
	})

	it("should refresh an existing key without evicting another entry", () => {
		// Arrange
		setPokemonCache("first", 1)
		setPokemonCache("second", 2)

		// Act
		setPokemonCache("first", 3)

		// Assert
		expect(getPokemonCache("first").value).toBe(3)
		expect(getPokemonCache("second").value).toBe(2)
	})
})
