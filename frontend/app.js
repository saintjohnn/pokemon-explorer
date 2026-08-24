import express from "express";
import { engine } from "express-handlebars";
import path from "node:path";

import pokemonRouter from "./routes/pokemon.routes.js";

const app = express();

app.disable("x-powered-by");

app.engine(
  "handlebars",
  engine({
    defaultLayout: "main",
  }),
);

app.set("view engine", "handlebars");

app.set("views", "./views");

app.use(express.static(path.join(process.cwd(), "public")));

app.use("/", pokemonRouter);

app.use((req, res) => {
  return res.status(404).send("Página não encontrada");
});

app.use((err, req, res, next) => {
  console.error(err);

  return res.status(500).send("Erro interno do servidor");
});

export default app;
