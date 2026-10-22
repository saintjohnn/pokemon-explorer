const THEME_STORAGE_KEY = "pokedex-theme"
const DEFAULT_LIMIT = 50

const root = window.document.documentElement
const themeToggle = window.document.querySelector("[data-theme-toggle]")
const pagination = window.document.querySelector("[data-pagination]")
const pokemonGrid = document.querySelector("[data-pokemon-grid]")
const pokemonSummary = document.querySelector(".pokemon-list__summary")
const pokemonSearch = document.querySelector("[data-pokemon-search]")

let activeListRequestId = 0

function getSavedTheme() {
	try {
		const theme = window.localStorage.getItem(THEME_STORAGE_KEY)

		return theme === "light" || theme === "dark" ? theme : null
	} catch {
		return null
	}
}

function saveTheme(theme) {
	try {
		window.localStorage.setItem(THEME_STORAGE_KEY, theme)
	} catch {
		// The preference was not able to be saved.
	}
}

function getPreferredTheme() {
	const savedTheme = getSavedTheme()

	if (savedTheme === "light" || savedTheme === "dark") {
		return savedTheme
	}

	return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function updateThemeButton(theme) {
	if (!themeToggle) {
		return
	}

	const isDark = theme === "dark"

	themeToggle.setAttribute("aria-pressed", String(isDark))

	themeToggle.setAttribute("aria-label", isDark ? "Enable light mode" : "Enable dark mode")

	themeToggle.title = isDark ? "Enable light mode" : "Enable dark mode"
}

function applyTheme(theme, { persist = true } = {}) {
	root.dataset.theme = theme

	updateThemeButton(theme)

	if (persist) {
		saveTheme(theme)
	}
}

applyTheme(getPreferredTheme(), { persist: false })

themeToggle?.addEventListener("click", () => {
	const nextTheme = root.dataset.theme === "dark" ? "light" : "dark"

	applyTheme(nextTheme)
})

const systemTheme = window.matchMedia("(prefers-color-scheme: dark)")

systemTheme.addEventListener("change", (event) => {
	if (getSavedTheme()) {
		return
	}

	applyTheme(event.matches ? "dark" : "light", { persist: false })
})

function buildPaginationItems(currentPage, totalPages) {
	if (totalPages <= 7) {
		return Array.from({ length: totalPages }, (_, index) => index + 1)
	}

	const pages = new Set([1, totalPages, currentPage])

	if (currentPage <= 3) {
		pages.add(2)
		pages.add(3)
	} else if (currentPage >= totalPages - 2) {
		pages.add(totalPages - 2)
		pages.add(totalPages - 1)
	} else {
		pages.add(currentPage - 1)
		pages.add(currentPage + 1)
	}

	const sortedPages = [...pages].sort((a, b) => a - b)

	const items = []

	for (let index = 0; index < sortedPages.length; index++) {
		const page = sortedPages[index]
		const previousPage = sortedPages[index - 1]

		if (page > 0 && page - previousPage > 1) {
			items.push(null)
		}

		items.push(page)
	}

	return items
}

function createPaginationMarkup(currentPage, totalPages) {
	const previousPage = Math.max(1, currentPage - 1)
	const nextPage = Math.min(totalPages, currentPage + 1)
	const items = buildPaginationItems(currentPage, totalPages)

	const pageButtons = items
		.map((page) => {
			if (page === null) {
				return '<span class="pagination__ellipsis" aria-hidden="true">…</span>'
			}

			const activeClass = page === currentPage ? " pagination__button--active" : ""

			const currentAttribute = page === currentPage ? ' aria-current="page"' : ""

			return `
        <button
          class="pagination__button${activeClass}"
          type="button"
          data-page="${page}"
          ${currentAttribute}
        >
          ${page}
        </button>
      `
		})
		.join("")

	return `
    <button
      class="pagination__button pagination__button--arrow"
      type="button"
      data-page="${previousPage}"
      aria-label="Previous page"
      ${currentPage > 1 ? "" : "disabled"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m14.5 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>

    <div class="pagination__list">
      ${pageButtons}
    </div>

    <button
      class="pagination__button pagination__button--arrow"
      type="button"
      data-page="${nextPage}"
      aria-label="Next page"
      ${currentPage < totalPages ? "" : "disabled"}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="m9.5 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  `
}

function createCard(pokemon) {
	const article = document.createElement("article")
	article.className = "pokemon-card"

	const link = document.createElement("a")
	link.className = "pokemon-card__link"
	link.href = `/pokemons/${pokemon.id}`

	const imageContainer = document.createElement("div")
	imageContainer.className = "pokemon-card__image-container"

	if (pokemon.image) {
		const image = document.createElement("img")
		image.className = "pokemon-card__image"
		image.src = pokemon.image
		image.alt = `${pokemon.name} image`
		image.loading = "lazy"
		imageContainer.append(image)
	}

	const content = document.createElement("div")
	content.className = "pokemon-card__content"

	const id = document.createElement("span")
	id.className = "pokemon-card__id"
	id.textContent = `#${pokemon.id}`

	const name = document.createElement("h2")
	name.className = "pokemon-card__name"
	name.textContent = pokemon.name

	const types = document.createElement("ul")
	types.className = "pokemon-card__types"
	types.setAttribute("aria-label", "Types")

	pokemon.types.forEach((type) => {
		const item = document.createElement("li")
		item.className = "pokemon-card__type"
		item.textContent = type
		types.append(item)
	})

	content.append(id, name, types)
	link.append(imageContainer, content)
	article.append(link)

	return article
}

function renderSkeletons() {
	const fragment = document.createDocumentFragment()

	for (let index = 0; index < 12; index += 1) {
		const card = document.createElement("article")
		card.className = "pokemon-card pokemon-card--skeleton"
		card.setAttribute("aria-hidden", "true")

		card.innerHTML = `
      <div class="pokemon-card__link">
        <div class="skeleton pokemon-card__image-skeleton"></div>
        <div class="pokemon-card__content">
          <div class="skeleton pokemon-card__id-skeleton"></div>
          <div class="skeleton pokemon-card__name-skeleton"></div>
          <div class="pokemon-card__types">
            <div class="skeleton pokemon-card__type-skeleton"></div>
            <div class="skeleton pokemon-card__type-skeleton"></div>
          </div>
        </div>
      </div>
    `

		fragment.append(card)
	}

	pokemonGrid.replaceChildren(fragment)
}

function renderPokemonCards(pokemons) {
	const fragment = document.createDocumentFragment()

	pokemons.forEach((pokemon) => {
		fragment.append(createCard(pokemon))
	})

	pokemonGrid.replaceChildren(fragment)
}

async function loadPage(page, { replaceHistory = true } = {}) {
	if (!pagination || !pokemonGrid) {
		return
	}

	const totalPages = Number(pagination.dataset.totalPages)

	if (page < 1 || page > totalPages) {
		return
	}

	const requestId = ++activeListRequestId

	pagination.classList.add("is-loading")
	pokemonGrid.classList.add("is-loading")
	pokemonGrid.setAttribute("aria-busy", "true")
	renderSkeletons()

	const offset = (page - 1) * DEFAULT_LIMIT

	try {
		const response = await fetch(`/api/pokemons?limit=${DEFAULT_LIMIT}&offset=${offset}`, {
			headers: { Accept: "application/json" },
		})

		if (!response.ok) {
			throw new Error(`Pokémon request failed with status ${response.status}`)
		}

		const data = await response.json()

		if (requestId !== activeListRequestId) {
			return
		}

		const nextTotalPages = Math.max(1, Math.ceil(data.count / DEFAULT_LIMIT))

		renderPokemonCards(data.results)

		pagination.dataset.currentPage = String(page)
		pagination.dataset.totalPages = String(nextTotalPages)
		pagination.innerHTML = createPaginationMarkup(page, nextTotalPages)
		pagination.classList.remove("is-loading")
		pokemonGrid.classList.remove("is-loading")
		pokemonGrid.setAttribute("aria-busy", "false")

		if (pokemonSummary) {
			pokemonSummary.textContent = `${data.count} species found`
		}

		if (replaceHistory) {
			const url = page === 1 ? "/" : `/?page=${page}`
			window.history.pushState({ page }, "", url)
		}

		window.scrollTo({ top: 0, behavior: "smooth" })
	} catch (error) {
		if (requestId !== activeListRequestId) {
			return
		}

		pagination.classList.remove("is-loading")
		pokemonGrid.classList.remove("is-loading")
		pokemonGrid.setAttribute("aria-busy", "false")

		const errorCard = document.createElement("div")
		errorCard.className = "pokemon-list__error"
		errorCard.textContent = "Could not load this page. Try again."
		pokemonGrid.replaceChildren(errorCard)

		console.error(error)
	}
}

async function searchPokemons(query) {
	if (!pokemonGrid || !pagination) {
		return
	}

	const requestId = ++activeListRequestId

	pagination.hidden = true
	pokemonGrid.classList.add("is-loading")
	pokemonGrid.setAttribute("aria-busy", "true")
	renderSkeletons()

	try {
		const searchParams = new URLSearchParams({ q: query })
		const response = await fetch(`/api/pokemons/search?${searchParams}`, {
			headers: { Accept: "application/json" },
		})

		if (!response.ok) {
			throw new Error(`Pokémon search failed with status ${response.status}`)
		}

		const data = await response.json()

		if (requestId !== activeListRequestId) {
			return
		}

		if (data.results.length > 0) {
			renderPokemonCards(data.results)
		} else {
			const emptyState = document.createElement("p")
			emptyState.className = "pokemon-list__empty"
			emptyState.textContent = `No Pokémon found for "${query}".`
			pokemonGrid.replaceChildren(emptyState)
		}

		if (pokemonSummary) {
			pokemonSummary.textContent =
				data.count > data.results.length
					? `Showing ${data.results.length} of ${data.count} matching Pokémon`
					: `${data.count} Pokémon found`
		}
	} catch (error) {
		if (requestId !== activeListRequestId) {
			return
		}

		const errorCard = document.createElement("div")
		errorCard.className = "pokemon-list__error"
		errorCard.textContent = "Could not search Pokémon. Try again."
		pokemonGrid.replaceChildren(errorCard)

		console.error(error)
	} finally {
		if (requestId === activeListRequestId) {
			pokemonGrid.classList.remove("is-loading")
			pokemonGrid.setAttribute("aria-busy", "false")
		}
	}
}

pokemonSearch?.addEventListener("input", (event) => {
	const query = event.currentTarget.value.trim()

	if (!query) {
		loadPage(1)
		return
	}

	searchPokemons(query)
})

pokemonSearch?.form?.addEventListener("submit", (event) => {
	event.preventDefault()
})

pagination?.addEventListener("click", (event) => {
	const button = event.target.closest("[data-page]")

	if (!button || button.disabled || pagination.classList.contains("is-loading")) {
		return
	}

	const page = Number(button.dataset.page)

	if (Number.isInteger(page)) {
		loadPage(page)
	}
})

window.addEventListener("popstate", () => {
	const params = new URLSearchParams(window.location.search)
	const page = Number(params.get("page") || "1")

	loadPage(Number.isInteger(page) ? page : 1, { replaceHistory: false })
})
