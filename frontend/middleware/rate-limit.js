import { rateLimit } from "express-rate-limit";

export function createApiLimiter({
  limit = 100,
  windowMs = 15 * 60 * 1000,
} = {}) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: "Too many requests. Please try again later.",
      message: "Many attempts. Please wait before trying again.",
    },
  });
}
