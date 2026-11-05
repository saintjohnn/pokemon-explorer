export function debounce(callback, delay) {
	let timeoutId

	function debounced(...args) {
		clearTimeout(timeoutId)

		timeoutId = setTimeout(() => {
			timeoutId = undefined
			callback(...args)
		}, delay)
	}

	debounced.cancel = () => {
		clearTimeout(timeoutId)
		timeoutId = undefined
	}

	return debounced
}

export function throttle(callback, delay) {
	let lastExecution = null

	return (...args) => {
		const now = Date.now()

		if (lastExecution !== null && now - lastExecution < delay) {
			return
		}

		lastExecution = now

		return callback(...args)
	}
}
