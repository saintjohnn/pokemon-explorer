import request from "supertest"
import app from "../../frontend/app.js"

describe("frontend API proxy", () => {
	it("should expose a health check endpoint", async () => {
		// Arrange

		// Act
		const response = await request(app).get("/health")

		// Assert
		expect(response.statusCode).toBe(200)
		expect(response.body).toStrictEqual({ status: "ok" })
	})

	afterEach(() => {
		vi.unstubAllGlobals()
		vi.restoreAllMocks()
	})

	it("should forward a normalized search request to the backend", async () => {
		// Arrange
		const backendResponse = { count: 1, results: [{ id: 25, name: "pikachu" }] }
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(JSON.stringify(backendResponse), {
				status: 200,
				headers: { "Content-Type": "application/json" },
			}),
		)
		vi.stubGlobal("fetch", fetchMock)

		// Act
		const response = await request(app)
			.get("/api/pokemons/search")
			.query({ q: "  pikachu  ", limit: "2", offset: "4" })

		// Assert
		expect(response.statusCode).toBe(200)
		expect(response.body).toStrictEqual(backendResponse)
		expect(fetchMock).toHaveBeenCalledOnce()
		const requestedUrl = new URL(fetchMock.mock.calls[0][0])
		expect(requestedUrl.pathname).toBe("/pokemons/search")
		expect(Object.fromEntries(requestedUrl.searchParams)).toStrictEqual({
			q: "pikachu",
			limit: "2",
			offset: "4",
		})
	})

	it("should use pagination defaults for invalid pagination values", async () => {
		// Arrange
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify({ count: 0, results: [] }), { status: 200 }))
		vi.stubGlobal("fetch", fetchMock)

		// Act
		const response = await request(app)
			.get("/api/pokemons/search")
			.query({ q: "pikachu", limit: "-1", offset: "1.5" })

		// Assert
		expect(response.statusCode).toBe(200)
		const requestedUrl = new URL(fetchMock.mock.calls[0][0])
		expect(requestedUrl.searchParams.get("limit")).toBe("50")
		expect(requestedUrl.searchParams.get("offset")).toBe("0")
	})

	it("should reject an empty query without calling the backend", async () => {
		// Arrange
		const fetchMock = vi.fn()
		vi.stubGlobal("fetch", fetchMock)

		// Act
		const response = await request(app).get("/api/pokemons/search").query({ q: "   " })

		// Assert
		expect(response.statusCode).toBe(400)
		expect(fetchMock).not.toHaveBeenCalled()
	})

	it("should preserve the backend response status and body", async () => {
		// Arrange
		const backendError = { message: "Invalid search query" }
		const fetchMock = vi
			.fn()
			.mockResolvedValue(new Response(JSON.stringify(backendError), { status: 400 }))
		vi.stubGlobal("fetch", fetchMock)

		// Act
		const response = await request(app).get("/api/pokemons/search").query({ q: "pikachu" })

		// Assert
		expect(response.statusCode).toBe(400)
		expect(response.body).toStrictEqual(backendError)
	})
})
