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
    it("should parse default pagination and return the paginated response with status 200", async () => {
      // Arrange
      const paginatedResponse = { count: 1302, results: [makePokemon()] };

      const pokemonService = {
        getPokemons: vi.fn().mockResolvedValue(paginatedResponse),
      };

      const controller = new PokemonController(pokemonService);

      const req = { query: {} };

      const res = makeResponse();

      const next = vi.fn();

      // Act
      await controller.getPokemons(req, res, next);

      // Assert
      expect(pokemonService.getPokemons).toHaveBeenCalledExactlyOnceWith({
        limit: 50,
        offset: 0,
      });
      expect(res.status).toHaveBeenCalledExactlyOnceWith(200);
      expect(res.json).toHaveBeenCalledExactlyOnceWith(paginatedResponse);
      expect(next).not.toHaveBeenCalled();
    });

    it("should parse custom pagination query parameters before calling service", async () => {
      //Arrange
      const paginatedResponse = { count: 1302, results: [] };

      const pokemonService = {
        getPokemons: vi.fn().mockResolvedValue(paginatedResponse),
      };

      const controller = new PokemonController(pokemonService);

      const req = { query: { limit: "25", offset: "50" } };

      const res = makeResponse();

      const next = vi.fn();

      //Act
      await controller.getPokemons(req, res, next);

      //Assert
      expect(pokemonService.getPokemons).toHaveBeenCalledExactlyOnceWith({
        limit: 25,
        offset: 50,
      });
      expect(res.json).toHaveBeenCalledExactlyOnceWith(paginatedResponse);
      expect(next).not.toHaveBeenCalled();
    });

    it.each([
      { limit: "0" },
      { limit: "abc" },
      { offset: "-1" },
      { offset: "1.5" },
    ])("should reject invalid pagination query %j", async (query) => {
      //Arrange
      const pokemonService = { getPokemons: vi.fn() };

      const controller = new PokemonController(pokemonService);

      const req = query;

      const res = makeResponse();

      const next = vi.fn();

      //Act
      await controller.getPokemons({ req }, res, next);

      //Assert
      expect(next).toHaveBeenCalledOnce();

      const [error] = next.mock.calls[0];

      expect(error).toBeInstanceOf(BadRequestError);
      expect(error.message).toBe("Invalid pagination parameters");
      expect(error.cause).toHaveProperty("name", "ZodError");
      expect(pokemonService.getPokemons).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it("should forward service errors after parsing valid pagination", async () => {
      // Arrange
      const error = new Error("service failed");

      const pokemonService = {
        getPokemons: vi.fn().mockRejectedValue(error),
      };

      const controller = new PokemonController(pokemonService);

      const req = { query: { limit: "10", offset: "20" } };

      const res = makeResponse();

      const next = vi.fn();

      // Act
      await controller.getPokemons(req, res, next);

      // Assert
      expect(pokemonService.getPokemons).toHaveBeenCalledExactlyOnceWith({
        limit: 10,
        offset: 20,
      });
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
