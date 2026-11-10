import { debounce, throttle } from "../../../frontend/public/javascript/async.js"

describe("debounce", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("should run only once after calls stop for the delay", () => {
		// Arrange
		vi.useFakeTimers()
		const callback = vi.fn()
		const debounced = debounce(callback, 300)

		// Act
		debounced("p")
		vi.advanceTimersByTime(100)
		debounced("pi")
		vi.advanceTimersByTime(100)
		debounced("pik")
		vi.advanceTimersByTime(299)

		// Assert
		expect(callback).not.toHaveBeenCalled()

		// Act
		vi.advanceTimersByTime(1)

		// Assert
		expect(callback).toHaveBeenCalledExactlyOnceWith("pik")
	})

	it("should cancel a pending execution", () => {
		// Arrange
		vi.useFakeTimers()
		const callback = vi.fn()
		const debounced = debounce(callback, 300)

		// Act
		debounced("pikachu")
		debounced.cancel()
		vi.advanceTimersByTime(300)

		// Assert
		expect(callback).not.toHaveBeenCalled()
	})
})

describe("throttle", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("should ignore calls made before the delay has elapsed", () => {
		// Arrange
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))
		const callback = vi.fn()
		const throttled = throttle(callback, 250)

		// Act
		throttled(1)
		vi.advanceTimersByTime(100)
		throttled(2)
		vi.advanceTimersByTime(150)
		throttled(3)

		// Assert
		expect(callback).toHaveBeenCalledTimes(2)
		expect(callback).toHaveBeenNthCalledWith(1, 1)
		expect(callback).toHaveBeenNthCalledWith(2, 3)
	})
})
