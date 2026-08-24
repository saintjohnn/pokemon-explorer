import PokemonController from "../../../backend/src/controllers/pokemon.controller.js";
import BadRequestError from "../../../backend/src/errors/bad-request.error.js";
import makePokemon from "../../factories/pokemon.factory.js";

function makeResponse() {
  return {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };
}

describe("PokemonController", () => {
  describe("getPokemons", () => {
    it("should return the pokemon list with status 200", async () => {
      // Arrange
      const pokemons = [
        makePokemon({
          name: "bulbasaur",
          id: 1,
          types: ["grass", "poison"],
          image:
            "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png",
        }),
      ];
      const pokemonService = {
        getPokemons: vi.fn().mockResolvedValue(pokemons),
      };
      const controller = new PokemonController(pokemonService);
      const res = makeResponse();
      const next = vi.fn();

      // Act
      await controller.getPokemons({}, res, next);

      // Assert
      expect(pokemonService.getPokemons).toHaveBeenCalledOnce();
      expect(res.status).toHaveBeenCalledExactlyOnceWith(200);
      expect(res.json).toHaveBeenCalledExactlyOnceWith(pokemons);
      expect(next).not.toHaveBeenCalled();
    });

    it("should forward service errors", async () => {
      // Arrange
      const error = new Error("service failed");
      const pokemonService = {
        getPokemons: vi.fn().mockRejectedValue(error),
      };
      const controller = new PokemonController(pokemonService);
      const res = makeResponse();
      const next = vi.fn();

      // Act
      await controller.getPokemons({}, res, next);

      // Assert
      expect(next).toHaveBeenCalledExactlyOnceWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });

  describe("getPokemonById", () => {
    it("should parse the route parameter and return the pokemon with status 200", async () => {
      // Arrange
      const pokemon = makePokemon();
      const pokemonService = {
        getPokemonById: vi.fn().mockResolvedValue(pokemon),
      };
      const controller = new PokemonController(pokemonService);
      const req = { params: { id: "1" } };
      const res = makeResponse();
      const next = vi.fn();

      // Act
      await controller.getPokemonById(req, res, next);

      // Assert
      expect(pokemonService.getPokemonById).toHaveBeenCalledExactlyOnceWith(1);
      expect(res.status).toHaveBeenCalledExactlyOnceWith(200);
      expect(res.json).toHaveBeenCalledExactlyOnceWith(pokemon);
      expect(next).not.toHaveBeenCalled();
    });

    it("should preserve the Zod error as the cause of an invalid id error", async () => {
      // Arrange
      const pokemonService = {
        getPokemonById: vi.fn(),
      };
      const controller = new PokemonController(pokemonService);
      const req = { params: { id: "invalid" } };
      const next = vi.fn();

      // Act
      await controller.getPokemonById(req, {}, next);

      // Assert
      expect(next).toHaveBeenCalledOnce();

      const [error] = next.mock.calls[0];

      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe("Invalid pokemon id");
      expect(error.cause).toHaveProperty("name", "ZodError");
      expect(pokemonService.getPokemonById).not.toHaveBeenCalled();
    });

    it("should forward service errors after parsing a valid id", async () => {
      // Arrange
      const error = new Error("service failed");
      const pokemonService = {
        getPokemonById: vi.fn().mockRejectedValue(error),
      };
      const controller = new PokemonController(pokemonService);
      const req = { params: { id: "1" } };
      const res = makeResponse();
      const next = vi.fn();

      // Act
      await controller.getPokemonById(req, res, next);

      // Assert
      expect(pokemonService.getPokemonById).toHaveBeenCalledExactlyOnceWith(1);
      expect(next).toHaveBeenCalledExactlyOnceWith(error);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
