export default function internalServerErrorHandler(err, _, res, _next) {
	console.error(err)

	return res.status(500).json({
		message: "internal server error",
	})
}
