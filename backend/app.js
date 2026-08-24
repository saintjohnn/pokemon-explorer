import express from "express";
import { engine } from "express-handlebars";
import pokemonRouter from "./src/routes/pokemon.routes.js";
import errorHandler from "./src/middlewares/app-error.handler.js";
import internalServerErrorHandler from "./src/middlewares/internal-server-error.handler.js";
 
const app = express();

app.disable("x-powered-by");

app.engine("handlebars", engine());

app.set("view engine", "handlebars");

app.set("views", "./views");

app.use(express.json({ limit: "10kb", strict: true }));

app.use("/pokemons", pokemonRouter);

app.use((req, res) => {
  return res.status(404).json({
    message: "Route not found",
  });
});

app.use(errorHandler);

app.use(internalServerErrorHandler);

export default app;
