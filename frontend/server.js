import { env } from "../config/env.js"
import app from "./app.js"

const port = env.frontendPort

app.listen(port, () => {
	console.log(`frontend running on http://localhost:${port}`)
})
