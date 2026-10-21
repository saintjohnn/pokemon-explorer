import BadRequestError from "../errors/bad-request.error.js"
import { paginationSchema } from "../schemas/pagination.schema.js"
import { paramsSchema } from "../schemas/params.schema.js"
import { pokemonSearchQuerySchema } from "../schemas/search.schema.js"

export default class PokemonController {
	constructor(pokemonService) {
		this.pokemonService = pokemonService
	}

	async getPokemons(req, res, next) {
		try {
			const parsedQuery = paginationSchema.safeParse(req.query)

			if (!parsedQuery.success) {
				throw new BadRequestError("Invalid pagination parameters", {
					cause: parsedQuery.error,
				})
			}

			const pokemons = await this.pokemonService.getPokemons(parsedQuery.data)

			return res.status(200).json(pokemons)
		} catch (error) {
			return next(error)
		}
	}

	async searchPokemons(req, res, next) {
		try {
			const parsedQuery = pokemonSearchQuerySchema.safeParse(req.query)

			if (!parsedQuery.success) {
				throw new BadRequestError("Invalid search query", {
					cause: parsedQuery.error,
				})
			}

			const pokemons = await this.pokemonService.searchPokemons(parsedQuery.data.q)

			return res.status(200).json(pokemons)
		} catch (error) {
			return next(error)
		}
	}

	async getPokemonById(req, res, next) {
		try {
			const parseId = paramsSchema.safeParse(req.params.id)

			if (!parseId.success) {
				throw new BadRequestError("Invalid pokemon id", {
					cause: parseId.error,
				})
			}

			const pokemon = await this.pokemonService.getPokemonById(parseId.data)

			return res.status(200).json(pokemon)
		} catch (error) {
			return next(error)
		}
	}
}
