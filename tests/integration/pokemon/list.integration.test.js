import request from "supertest"
import app from "../../../backend/app.js"
import pokemonCache from "../../../backend/src/cache/pokemon.cache.js"
import pokeApi from "../../../backend/src/clients/pokeapi.client.js"
import PokeApiError from "../../../backend/src/errors/poke-api.error.js"
import { env } from "../../../backend/config/env.js"
import makePokemon from "../../factories/pokemon.factory.js"
import makePokemonCard from "../../factories/pokemon-card.factory.js"

vi.mock("../../../backend/src/clients/pokeapi.client.js", () => ({
	default: vi.fn(),
}))

const defaultListEndpoint = "pokemon?limit=50&offset=0"
const bulbasaurUrl = "https://pokeapi.co/api/v2/pokemon/1/"
const ivysaurUrl = "https://pokeapi.co/api/v2/pokemon/2/"

function cachedPageKey(limit, offset) {
	return `${env.pokemonListCacheKey}:limit=${limit}:offset=${offset}`
}

describe("GET /pokemons", () => {
	beforeEach(() => {
		vi.resetAllMocks()
		vi.clearAllMocks()
		pokemonCache.flushAll()
	})

	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("should return count and mapped pokemon cards for the default page", async () => {
		// Arrange
		const bulbasaur = makePokemon()
		const ivysaur = makePokemon({
			id: 2,
			name: "ivysaur",
			sprites: {
				front_default:
					"https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png",
			},
		})
		const expected = {
			count: 1302,
			results: [
				makePokemonCard(),
				makePokemonCard({
					id: 2,
					name: "ivysaur",
					image: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/2.png",
				}),
			],
		}

		pokeApi
			.mockResolvedValueOnce({
				count: 1302,
				results: [{ url: bulbasaurUrl }, { url: ivysaurUrl }],
			})
			.mockResolvedValueOnce(bulbasaur)
			.mockResolvedValueOnce(ivysaur)

		// Act
		const response = await request(app).get("/pokemons")

		// Assert
		expect(response.statusCode).toBe(200)
		expect(response.body).toStrictEqual(expected)
		expect(pokeApi).toHaveBeenNthCalledWith(1, defaultListEndpoint)
		expect(pokemonCache.get(cachedPageKey(50, 0))).toStrictEqual(expected)
	})

	it("should forward custom limit and offset to PokeAPI and return count", async () => {
		// Arrange
		const pokemon = makePokemon()
		const expected = { count: 1302, results: [makePokemonCard()] }

		pokeApi
			.mockResolvedValueOnce({ count: 1302, results: [{ url: bulbasaurUrl }] })
			.mockResolvedValueOnce(pokemon)

		// Act
		const response = await request(app).get("/pokemons").query({ limit: 50, offset: 50 })

		// Assert
		expect(response.statusCode).toBe(200)
		expect(response.body).toStrictEqual(expected)
		expect(pokeApi).toHaveBeenNthCalledWith(1, "pokemon?limit=50&offset=50")
		expect(pokemonCache.get(cachedPageKey(50, 50))).toStrictEqual(expected)
	})

	it.each([
		["limit", "0"],
		["limit", "abc"],
		["offset", "-1"],
		["offset", "1.5"],
	])("should return 400 for an invalid %s value", async (field, value) => {
		// Arrange

		// Act
		const response = await request(app)
			.get("/pokemons")
			.query({ [field]: value })

		// Assert
		expect(response.statusCode).toBe(400)
		expect(response.body).toStrictEqual({
			message: "Invalid pagination parameters",
		})
		expect(pokeApi).not.toHaveBeenCalled()
	})

	it("should return an empty page while preserving the total count", async () => {
		// Arrange
		pokeApi.mockResolvedValueOnce({ count: 1302, results: [] })

		// Act
		const response = await request(app).get("/pokemons?limit=50&offset=1300")

		// Assert
		expect(response.statusCode).toBe(200)
		expect(response.body).toStrictEqual({ count: 1302, results: [] })
	})

	it("should reject an external list response without count", async () => {
		// Arrange
		pokeApi.mockResolvedValueOnce({ results: [] })

		// Act
		const response = await request(app).get("/pokemons")

		// Assert
		expect(response.statusCode).toBe(502)
		expect(response.body.message).toContain("count")
	})

	it("should use a separate cache entry for different pages", async () => {
		// Arrange
		const bulbasaur = makePokemon()
		const ivysaur = makePokemon({ id: 2, name: "ivysaur" })

		pokeApi
			.mockResolvedValueOnce({ count: 1302, results: [{ url: bulbasaurUrl }] })
			.mockResolvedValueOnce(bulbasaur)
			.mockResolvedValueOnce({ count: 1302, results: [{ url: ivysaurUrl }] })
			.mockResolvedValueOnce(ivysaur)

		// Act
		const first = await request(app).get("/pokemons?limit=50&offset=0")
		const second = await request(app).get("/pokemons?limit=50&offset=50")
		const firstAgain = await request(app).get("/pokemons?limit=50&offset=0")

		// Assert
		expect(first.statusCode).toBe(200)
		expect(second.statusCode).toBe(200)
		expect(firstAgain.statusCode).toBe(200)
		expect(firstAgain.body).toStrictEqual(first.body)
		expect(pokeApi).toHaveBeenCalledTimes(4)
	})

	it("should return 502 when the list request returns a PokeApiError", async () => {
		// Arrange
		pokeApi.mockRejectedValueOnce(new PokeApiError("PokeAPI responded with status 503"))

		// Act
		const response = await request(app).get("/pokemons")

		// Assert
		expect(response.statusCode).toBe(502)
		expect(response.body).toStrictEqual({
			message: "PokeAPI responded with status 503",
		})
	})

	it("should return 502 when an individual pokemon request returns a PokeApiError", async () => {
		// Arrange
		pokeApi
			.mockResolvedValueOnce({ count: 1, results: [{ url: bulbasaurUrl }] })
			.mockRejectedValueOnce(new PokeApiError("PokeAPI responded with status 429"))

		// Act
		const response = await request(app).get("/pokemons")

		// Assert
		expect(response.statusCode).toBe(502)
		expect(response.body).toStrictEqual({
			message: "PokeAPI responded with status 429",
		})
	})

	it("should return 502 when the external list structure is invalid", async () => {
		// Arrange
		pokeApi.mockResolvedValueOnce({})

		// Act
		const response = await request(app).get("/pokemons")

		// Assert
		expect(response.statusCode).toBe(502)
		expect(response.body).toStrictEqual({
			message: expect.stringContaining("count"),
		})
	})

	it("should return 502 when the external list contains a disallowed pokemon URL", async () => {
		// Arrange
		pokeApi.mockResolvedValueOnce({
			count: 1,
			results: [{ url: "https://example.com/api/v2/pokemon/1/" }],
		})

		// Act
		const response = await request(app).get("/pokemons")

		// Assert
		expect(response.statusCode).toBe(502)
		expect(response.body).toStrictEqual({
			message: expect.stringContaining("results.0.url"),
		})
		expect(pokeApi).toHaveBeenCalledExactlyOnceWith(defaultListEndpoint)
	})

	it("should return 502 when an individual pokemon response is invalid", async () => {
		// Arrange
		pokeApi
			.mockResolvedValueOnce({ count: 1, results: [{ url: bulbasaurUrl }] })
			.mockResolvedValueOnce(makePokemon({ id: "invalid-id" }))

		// Act
		const response = await request(app).get("/pokemons")

		// Assert
		expect(response.statusCode).toBe(502)
		expect(response.body).toStrictEqual({
			message: expect.stringContaining("id"),
		})
	})

	it("should hide and log an unexpected failure from the list request", async () => {
		// Arrange
		const error = new TypeError("fetch failed")
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})
		pokeApi.mockRejectedValueOnce(error)

		// Act
		const response = await request(app).get("/pokemons")

		// Assert
		expect(response.statusCode).toBe(500)
		expect(response.body).toStrictEqual({ message: "internal server error" })
		expect(response.body.message).not.toContain(error.message)
		expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(error)
	})

	it("should hide and log an unexpected failure from an individual pokemon request", async () => {
		// Arrange
		const error = new TypeError("fetch failed")
		const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {})

		pokeApi
			.mockResolvedValueOnce({ count: 1, results: [{ url: bulbasaurUrl }] })
			.mockRejectedValueOnce(error)

		// Act
		const response = await request(app).get("/pokemons")

		// Assert
		expect(response.statusCode).toBe(500)
		expect(response.body).toStrictEqual({ message: "internal server error" })
		expect(response.body.message).not.toContain(error.message)
		expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(error)
	})

	it("should use the cache after the first request completes", async () => {
		// Arrange
		const bulbasaur = makePokemon()
		pokeApi
			.mockResolvedValueOnce({ count: 1, results: [{ url: bulbasaurUrl }] })
			.mockResolvedValueOnce(bulbasaur)

		// Act
		const firstResult = await request(app).get("/pokemons")
		const callsAfterFirstRequest = pokeApi.mock.calls.length
		const secondResult = await request(app).get("/pokemons")

		// Assert
		expect(firstResult.statusCode).toBe(200)
		expect(secondResult.statusCode).toBe(200)
		expect(secondResult.body).toStrictEqual(firstResult.body)
		expect(pokeApi).toHaveBeenCalledTimes(callsAfterFirstRequest)
	})

	it("should return cached paginated data without calling PokeAPI", async () => {
		// Arrange
		const cachedPage = { count: 1302, results: [makePokemonCard()] }
		pokemonCache.set(cachedPageKey(50, 50), cachedPage)

		// Act
		const response = await request(app).get("/pokemons?limit=50&offset=50")

		// Assert
		expect(response.statusCode).toBe(200)
		expect(response.body).toStrictEqual(cachedPage)
		expect(pokeApi).not.toHaveBeenCalled()
	})

	it("should share the same operation between concurrent requests for the same page", async () => {
		// Arrange
		let resolveListRequest
		let pokeApiStarted

		const pokeApiStartedPromise = new Promise((resolve) => {
			pokeApiStarted = resolve
		})

		pokeApi.mockImplementation((path) => {
			if (path === defaultListEndpoint) {
				pokeApiStarted()
				return new Promise((resolve) => {
					resolveListRequest = resolve
				})
			}

			return Promise.resolve(makePokemon())
		})

		const requests = Array.from({ length: 5 }, () =>
			request(app)
				.get("/pokemons")
				.then((response) => response.body),
		)

		// Act
		await pokeApiStartedPromise

		// Assert
		expect(pokeApi).toHaveBeenCalledOnce()

		//Act
		resolveListRequest({
			count: 1,
			results: [{ url: bulbasaurUrl }],
		})

		const results = await Promise.all(requests)

		//Assert
		expect(results).toHaveLength(5)
		expect(results.every((result) => result.count === 1)).toBe(true)
		expect(results.every((result) => result.results.length === 1)).toBe(true)
		expect(pokeApi).toHaveBeenCalledTimes(2)
	})
})
