import request from "supertest"
import app from "../../../backend/app.js"
import { clearPokemonCache } from "../../../backend/src/cache/pokemon.cache.js"
import pokemonListCache from "../../../backend/src/cache/pokemon-list.cache.js"
import pokeApi from "../../../backend/src/clients/pokeapi.client.js"
import PokeApiError from "../../../backend/src/errors/poke-api.error.js"
import makePokemon from "../../factories/pokemon.factory.js"
import makePokemonCard from "../../factories/pokemon-card.factory.js"

vi.mock("../../../backend/src/clients/pokeapi.client.js", () => ({
	default: vi.fn(),
}))

const pokemonListEndpoint = "pokemon?limit=2000&offset=0"
const pokemonUrls = [
	"https://pokeapi.co/api/v2/pokemon/1/",
	"https://pokeapi.co/api/v2/pokemon/2/",
	"https://pokeapi.co/api/v2/pokemon/3/",
	"https://pokeapi.co/api/v2/pokemon/25/",
]

function makePokemonList(results) {
	return {
		count: results.length,
		results: results.map(({ name, url }) => ({ name, url })),
	}
}

describe("GET /pokemons/search", () => {
	beforeEach(() => {
		vi.resetAllMocks()
		clearPokemonCache()
		pokemonListCache.flushAll()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should paginate matching Pokémon using limit and offset", async () => {
		pokeApi
			.mockResolvedValueOnce(
				makePokemonList([
					{ name: "bulbasaur", url: pokemonUrls[0] },
					{ name: "ivysaur", url: pokemonUrls[1] },
					{ name: "venusaur", url: pokemonUrls[2] },
				]),
			)
			.mockResolvedValueOnce(makePokemon({ id: 3, name: "venusaur" }))

		const response = await request(app)
			.get("/pokemons/search")
			.query({ q: "saur", limit: "2", offset: "2" })

		expect(response.statusCode).toBe(200)
		expect(response.body).toStrictEqual({
			count: 3,
			results: [makePokemonCard({ id: 3, name: "venusaur" })],
		})
		expect(pokeApi).toHaveBeenCalledTimes(2)
		expect(pokeApi).toHaveBeenNthCalledWith(2, pokemonUrls[2])
	})

	it("should return Pokémon whose names include the case-insensitive query", async () => {
		const list = makePokemonList([
			{ name: "bulbasaur", url: pokemonUrls[0] },
			{ name: "ivysaur", url: pokemonUrls[1] },
			{ name: "venusaur", url: pokemonUrls[2] },
			{ name: "pikachu", url: pokemonUrls[3] },
		])

		pokeApi
			.mockResolvedValueOnce(list)
			.mockResolvedValueOnce(makePokemon({ id: 1, name: "bulbasaur" }))
			.mockResolvedValueOnce(makePokemon({ id: 2, name: "ivysaur" }))
			.mockResolvedValueOnce(makePokemon({ id: 3, name: "venusaur" }))

		const response = await request(app).get("/pokemons/search").query({ q: "SAUR" })

		expect(response.statusCode).toBe(200)
		expect(response.body).toStrictEqual({
			count: 3,
			results: [
				makePokemonCard({ id: 1, name: "bulbasaur" }),
				makePokemonCard({ id: 2, name: "ivysaur" }),
				makePokemonCard({ id: 3, name: "venusaur" }),
			],
		})
		expect(pokeApi).toHaveBeenNthCalledWith(1, pokemonListEndpoint)
		expect(pokeApi).toHaveBeenNthCalledWith(2, pokemonUrls[0])
		expect(pokeApi).toHaveBeenNthCalledWith(3, pokemonUrls[1])
		expect(pokeApi).toHaveBeenNthCalledWith(4, pokemonUrls[2])
	})

	it("should trim the query and return an empty result when no Pokémon matches", async () => {
		pokeApi.mockResolvedValueOnce(makePokemonList([{ name: "pikachu", url: pokemonUrls[3] }]))

		const response = await request(app).get("/pokemons/search").query({ q: "  missing  " })

		expect(response.statusCode).toBe(200)
		expect(response.body).toStrictEqual({ count: 0, results: [] })
		expect(pokeApi).toHaveBeenCalledExactlyOnceWith(pokemonListEndpoint)
	})

	it("should require a non-empty query", async () => {
		const missingQueryResponse = await request(app).get("/pokemons/search")
		const emptyQueryResponse = await request(app).get("/pokemons/search").query({ q: "   " })

		expect(missingQueryResponse.statusCode).toBe(400)
		expect(missingQueryResponse.body).toStrictEqual({ message: "Invalid search query" })
		expect(emptyQueryResponse.statusCode).toBe(400)
		expect(emptyQueryResponse.body).toStrictEqual({ message: "Invalid search query" })
		expect(pokeApi).not.toHaveBeenCalled()
	})

	it("should reject queries longer than 100 characters", async () => {
		const response = await request(app)
			.get("/pokemons/search")
			.query({ q: "a".repeat(101) })

		expect(response.statusCode).toBe(400)
		expect(response.body).toStrictEqual({ message: "Invalid search query" })
		expect(pokeApi).not.toHaveBeenCalled()
	})

	it("should reuse the cached Pokémon list for different searches", async () => {
		pokeApi
			.mockResolvedValueOnce(
				makePokemonList([
					{ name: "bulbasaur", url: pokemonUrls[0] },
					{ name: "ivysaur", url: pokemonUrls[1] },
				]),
			)
			.mockResolvedValueOnce(makePokemon({ id: 1, name: "bulbasaur" }))
			.mockResolvedValueOnce(makePokemon({ id: 2, name: "ivysaur" }))

		const bulbasaurResponse = await request(app).get("/pokemons/search").query({ q: "bulb" })
		const ivysaurResponse = await request(app).get("/pokemons/search").query({ q: "ivy" })

		expect(bulbasaurResponse.statusCode).toBe(200)
		expect(ivysaurResponse.statusCode).toBe(200)
		expect(bulbasaurResponse.body.results[0].name).toBe("bulbasaur")
		expect(ivysaurResponse.body.results[0].name).toBe("ivysaur")
		expect(pokeApi).toHaveBeenCalledTimes(3)
		expect(pokeApi).toHaveBeenNthCalledWith(1, pokemonListEndpoint)
	})

	it("should reuse cached search results when the normalized query is the same", async () => {
		pokeApi
			.mockResolvedValueOnce(makePokemonList([{ name: "bulbasaur", url: pokemonUrls[0] }]))
			.mockResolvedValueOnce(makePokemon({ id: 1, name: "bulbasaur" }))

		const firstResponse = await request(app).get("/pokemons/search").query({ q: " BulB " })
		const secondResponse = await request(app).get("/pokemons/search").query({ q: "bulb" })

		expect(firstResponse.statusCode).toBe(200)
		expect(secondResponse.statusCode).toBe(200)
		expect(secondResponse.body).toStrictEqual(firstResponse.body)
		expect(pokeApi).toHaveBeenCalledTimes(2)
	})

	it("should return 502 when the Pokémon list response is invalid", async () => {
		pokeApi.mockResolvedValueOnce({ results: [] })

		const response = await request(app).get("/pokemons/search").query({ q: "bulb" })

		expect(response.statusCode).toBe(502)
		expect(response.body.message).toContain("count")
	})

	it("should return 502 when the list request returns a PokeApiError", async () => {
		pokeApi.mockRejectedValueOnce(new PokeApiError("PokeAPI responded with status 503"))

		const response = await request(app).get("/pokemons/search").query({ q: "bulb" })

		expect(response.statusCode).toBe(502)
		expect(response.body).toStrictEqual({
			message: "PokeAPI responded with status 503",
		})
	})

	it("should return 502 when a matching Pokémon request returns a PokeApiError", async () => {
		pokeApi
			.mockResolvedValueOnce(makePokemonList([{ name: "bulbasaur", url: pokemonUrls[0] }]))
			.mockRejectedValueOnce(new PokeApiError("PokeAPI responded with status 429"))

		const response = await request(app).get("/pokemons/search").query({ q: "bulb" })

		expect(response.statusCode).toBe(502)
		expect(response.body).toStrictEqual({
			message: "PokeAPI responded with status 429",
		})
	})

	it("should hide and log unexpected failures", async () => {
		const error = new TypeError("fetch failed")
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		pokeApi.mockRejectedValueOnce(error)

		const response = await request(app).get("/pokemons/search").query({ q: "bulb" })

		expect(response.statusCode).toBe(500)
		expect(response.body).toStrictEqual({ message: "internal server error" })
		expect(response.body.message).not.toContain(error.message)
		expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(error)
	})
})
