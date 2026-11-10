function parsePort(value, fallback) {
	const parsed = Number(value)

	return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65_535 ? parsed : fallback
}

function parseNonNegativeInteger(value, fallback) {
	const parsed = Number(value)

	return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback
}

const backendUrl = new URL(process.env.BACKEND_URL ?? "http://127.0.0.1:3000")

if (!new Set(["http:", "https:"]).has(backendUrl.protocol)) {
	throw new Error("BACKEND_URL must use HTTP or HTTPS")
}

export const env = {
	backendUrl: backendUrl.toString().replace(/\/+$/, ""),
	frontendPort: parsePort(process.env.FRONTEND_PORT, 4000),
	trustProxyHops: parseNonNegativeInteger(process.env.TRUST_PROXY_HOPS, 0),
}
