import path from "node:path"
import express from "express"
import { engine } from "express-handlebars"
import helmet from "helmet"
import pokemonRouter from "./routes/pokemon.routes.js"
import { rootDir } from "./utils/path.js"

const app = express()

app.disable("x-powered-by")

app.use(
	helmet({
		contentSecurityPolicy: {
			directives: {
				imgSrc: ["'self'", "data:", "https://raw.githubusercontent.com"],
			},
		},
	}),
)

app.engine(
	"handlebars",
	engine({
		defaultLayout: "main",
		helpers: {
			eq: (left, right) => left === right,
		},
	}),
)

app.set("view engine", "handlebars")

app.set("views", path.join(rootDir, "views"))

app.use(express.static(path.join(rootDir, "public")))

app.use("/", pokemonRouter)

app.use((_, res) => {
	return res.status(404).render("not-found", {
		title: "Page not found | Pokédex",
	})
})

app.use((err, _, res, _next) => {
	console.error(err)

	return res.status(500).send("Internal Server Error")
})

export default app
