import { Router } from "express"
import { createApiLimiter } from "../middleware/rate-limit.js"
import {
	createPaginationView,
	getOffsetForPage,
	POKEMONS_PER_PAGE,
	parsePage,
} from "../utils/pagination.js"

const router = Router()

const backendUrl = "http://localhost:3000"

const apiLimiter = createApiLimiter()

// The SSR route fetches the requested page using the same paging contract used by the client
async function fetchPokemonPage(page) {
	const offset = getOffsetForPage(page, POKEMONS_PER_PAGE)
	const searchParamns = new URLSearchParams({
		limit: String(POKEMONS_PER_PAGE),
		offset: String(offset),
	})

	const response = await fetch(`${backendUrl}/pokemons?${searchParamns}`)

	if (!response.ok) {
		throw new Error(`Backend responded with status ${response.status}`)
	}

	return response.json()
}

router.get("/", async (req, res, next) => {
	try {
		const page = parsePage(req.query.page)

		const paginatedResponse = await fetchPokemonPage(page)

		const pagination = createPaginationView({
			count: paginatedResponse.count,
			limit: POKEMONS_PER_PAGE,
			currentPage: page,
		})

		if (page > pagination.totalPages) {
			return res.status(404).render("not-found", {
				title: "Page not found | Pokédex",
			})
		}

		return res.render("home", {
			title: "Pokédex",
			pokemons: paginatedResponse.results,
			count: paginatedResponse.count,
			pagination,
		})
	} catch (error) {
		return next(error)
	}
})

// This small proxy keeps browser requests same-origin while the backend remains private to the frontend server
router.get("/api/pokemons", apiLimiter, async (req, res, next) => {
	try {
		const requestedLimit = Number(req.query.limit)
		const requestedOffset = Number(req.query.offset)

		const limit =
			Number.isInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : POKEMONS_PER_PAGE

		const offset = Number.isInteger(requestedOffset) && requestedOffset >= 0 ? requestedOffset : 0

		const searchParams = new URLSearchParams({
			limit: String(limit),
			offset: String(offset),
		})

		const response = await fetch(`${backendUrl}/pokemons?${searchParams}`)
		const body = await response.json()

		return res.status(response.status).json(body)
	} catch (error) {
		return next(error)
	}
})

router.get("/pokemons/:id", async (req, res, next) => {
	try {
		const { id } = req.params

		const response = await fetch(`${backendUrl}/pokemons/${encodeURIComponent(id)}`)

		if (response.status === 404 || response.status === 400) {
			return res.status(404).render("not-found", {
				title: "Pokemon not found | Pokédex",
			})
		}

		if (!response.ok) {
			throw new Error(`Backend responded with status ${response.status}`)
		}

		const pokemon = await response.json()

		return res.render("pokemon", {
			title: `${pokemon.name} | Pokédex`,
			pokemon,
		})
	} catch (error) {
		return next(error)
	}
})

export default router
