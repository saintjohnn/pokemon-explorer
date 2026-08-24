import request from "supertest";
import app from "../../backend/app.js";

describe("application HTTP behavior", () => {
  it("should return a JSON 404 response for an unknown route", async () => {
    // Act
    const response = await request(app).get("/unknown-route");

    // Assert
    expect(response.statusCode).toBe(404);
    expect(response.body).toStrictEqual({
      message: "Route not found",
    });
  });

  it("should not expose the Express x-powered-by header", async () => {
    // Act
    const response = await request(app).get("/unknown-route");

    // Assert
    expect(response.headers).not.toHaveProperty("x-powered-by");
  });

  it("should return 400 without exposing parser details for invalid JSON", async () => {
    // Act
    const response = await request(app)
      .post("/pokemons")
      .set("Content-Type", "application/json")
      .send('{"invalidJson":');

    // Assert
    expect(response.statusCode).toBe(400);
    expect(response.body).toStrictEqual({
      message: "Invalid JSON payload",
    });
  });

  it("should reject a top-level JSON primitive when strict mode is enabled", async () => {
    // Act
    const response = await request(app)
      .post("/pokemons")
      .set("Content-Type", "application/json")
      .send('"bulbasaur"');

    // Assert
    expect(response.statusCode).toBe(400);
    expect(response.body).toStrictEqual({
      message: "Invalid JSON payload",
    });
  });

  it("should reject JSON payloads larger than 10kb", async () => {
    // Arrange
    const payload = JSON.stringify({ value: "a".repeat(11 * 1024) });

    // Act
    const response = await request(app)
      .post("/pokemons")
      .set("Content-Type", "application/json")
      .send(payload);

    // Assert
    expect(response.statusCode).toBe(413);
    expect(response.body).toStrictEqual({
      message: "Payload too large",
    });
  });

  it("should reject an unsupported JSON charset", async () => {
    // Act
    const response = await request(app)
      .post("/pokemons")
      .set("Content-Type", "application/json; charset=made-up")
      .send("{}");

    // Assert
    expect(response.statusCode).toBe(415);
    expect(response.body).toStrictEqual({
      message: "Unsupported charset",
    });
  });

  it("should reject an unsupported content encoding", async () => {
    // Act
    const response = await request(app)
      .post("/pokemons")
      .set("Content-Type", "application/json")
      .set("Content-Encoding", "made-up")
      .send("{}");

    // Assert
    expect(response.statusCode).toBe(415);
    expect(response.body).toStrictEqual({
      message: "Unsupported content encoding",
    });
  });
});
