import { existsSync } from "node:fs"

if (process.env.NODE_ENV !== "production" && existsSync(".git")) {
	const { default: husky } = await import("husky")
	husky()
}
