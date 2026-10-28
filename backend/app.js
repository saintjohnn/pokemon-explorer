import express from "express"
import helmet from "helmet"
import errorHandler from "./src/middlewares/app-error.handler.js"
import internalServerErrorHandler from "./src/middlewares/internal-server-error.handler.js"
import pokemonRouter from "./src/routes/pokemon.routes.js"

const app = express()

app.disable("x-powered-by")

app.use(
	helmet({
		contentSecurityPolicy: false,
	}),
)

app.use(express.json({ limit: "10kb", strict: true }))

app.use("/pokemons", pokemonRouter)

app.use((_, res) => {
	return res.status(404).json({
		message: "Route not found",
	})
})

app.use(errorHandler)

app.use(internalServerErrorHandler)

export default app
