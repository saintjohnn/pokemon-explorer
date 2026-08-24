import { Router } from "express";
import PokemonController from "../controllers/pokemon.controller.js";
import PokemonService from "../services/pokemon.service.js";

const pokemonRouter = Router();
const pokemonService = new PokemonService();
const pokemonController = new PokemonController(pokemonService);
 
pokemonRouter
  .get("/", pokemonController.getPokemons.bind(pokemonController))
  .get("/:id", pokemonController.getPokemonById.bind(pokemonController));

export default pokemonRouter;
