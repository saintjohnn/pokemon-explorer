;(() => {
	const key = "pokedex-theme"
	let saved = null

	try {
		saved = window.localStorage.getItem(key)
	} catch {
		// Without access to storage, uses system preference.
	}

	const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches

	const theme = saved === "light" || saved === "dark" ? saved : prefersDark ? "dark" : "light"

	document.documentElement.dataset.theme = theme
})()
