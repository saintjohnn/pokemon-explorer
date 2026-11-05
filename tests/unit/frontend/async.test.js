import { debounce, throttle } from "../../../frontend/public/javascript/async.js"

describe("debounce", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("should run only once after calls stop for the delay", () => {
		vi.useFakeTimers()
		const callback = vi.fn()
		const debounced = debounce(callback, 300)

		debounced("p")
		vi.advanceTimersByTime(100)
		debounced("pi")
		vi.advanceTimersByTime(100)
		debounced("pik")
		vi.advanceTimersByTime(299)

		expect(callback).not.toHaveBeenCalled()

		vi.advanceTimersByTime(1)

		expect(callback).toHaveBeenCalledExactlyOnceWith("pik")
	})

	it("should cancel a pending execution", () => {
		vi.useFakeTimers()
		const callback = vi.fn()
		const debounced = debounce(callback, 300)

		debounced("pikachu")
		debounced.cancel()
		vi.advanceTimersByTime(300)

		expect(callback).not.toHaveBeenCalled()
	})
})

describe("throttle", () => {
	afterEach(() => {
		vi.useRealTimers()
	})

	it("should ignore calls made before the delay has elapsed", () => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"))

		const callback = vi.fn()
		const throttled = throttle(callback, 250)

		throttled(1)
		vi.advanceTimersByTime(100)
		throttled(2)
		vi.advanceTimersByTime(150)
		throttled(3)

		expect(callback).toHaveBeenCalledTimes(2)
		expect(callback).toHaveBeenNthCalledWith(1, 1)
		expect(callback).toHaveBeenNthCalledWith(2, 3)
	})
})
