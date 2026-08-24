import { paramsSchema } from "../schemas/params.schema.js";
import BadRequestError from "../errors/bad-request.error.js";

export default class PokemonController {
  constructor(pokemonService) {
    this.pokemonService = pokemonService;
  }

  async getPokemons(req, res, next) {
    try {
      const pokemons = await this.pokemonService.getPokemons();

      return res.status(200).json(pokemons);
    } catch (error) {
      return next(error);
    }
  }

  async getPokemonById(req, res, next) {
    try {
      const parseId = paramsSchema.safeParse(req.params.id);

      if (!parseId.success) {
        throw new BadRequestError("Invalid pokemon id", {
          cause: parseId.error,
        });
      }

      const pokemon = await this.pokemonService.getPokemonById(parseId.data);

      return res.status(200).json(pokemon);
    } catch (error) {
      return next(error);
    }
  }
}
