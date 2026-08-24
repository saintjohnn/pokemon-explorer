import { Router } from "express";

const router = Router();

const backendUrl = "http://localhost:3000";

router.get("/", async (req, res, next) => {
  try {
    const response = await fetch(`${backendUrl}/pokemons`);

    if (!response.ok) {
      throw new Error(`Backend responded with status ${response.status}`);
    }

    const pokemons = await response.json();

    return res.render("home", {
      title: "Pokédex",
      pokemons,
    });
  } catch (error) {
    return next(error);
  }
});

router.get("/pokemons/:id", async (req, res, next) => {
  try {
    const { id } = req.params;

    const response = await fetch(
      `${backendUrl}/pokemons/${encodeURIComponent(id)}`,
    );

    if (response.status === 404) {
      return res.status(404).send("Pokémon não encontrado");
    }

    if (!response.ok) {
      throw new Error(`Backend responded with status ${response.status}`);
    }

    const pokemon = await response.json();

    return res.render("pokemon", {
      title: `${pokemon.name} | Pokédex`,
      pokemon,
    });
  } catch (error) {
    return next(error);
  }
});

export default router;
