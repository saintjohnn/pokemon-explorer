import express from "express";
import request from "supertest";

import { createApiLimiter } from "../../frontend/middleware/rate-limit.js";

it("should allow requests up to the limit and blocks the following ones", async () => {
  //Arrange
  const app = express();

  const apiLimiter = createApiLimiter({
    limit: 2,
    windowMs: 60_000,
  });

  app.get("/api/pokemons", apiLimiter, (req, res) => {
    res.status(200).json({ results: [] });
  });

  //Act
  const firstResponse = await request(app).get("/api/pokemons");
  const secondResponse = await request(app).get("/api/pokemons");
  const thirdResponse = await request(app).get("/api/pokemons");

  //Assert
  expect(firstResponse.status).toBe(200);
  expect(secondResponse.status).toBe(200);
  expect(thirdResponse.status).toBe(429);

  expect(thirdResponse.body).toStrictEqual({
    error: "Too many requests. Please try again later.",
    message: "Many attempts. Please wait before trying again.",
  });
});
