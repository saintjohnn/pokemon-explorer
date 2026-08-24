import AppError from "../../../backend/src/errors/app.error.js";
import BadRequestError from "../../../backend/src/errors/bad-request.error.js";
import NotFoundError from "../../../backend/src/errors/not-found.error.js";
import PokeApiError from "../../../backend/src/errors/poke-api.error.js";
import ValidationError from "../../../backend/src/errors/validation.error.js";

describe("AppError", () => {
  it("should inherit from Error and preserve its properties", () => {
    // Arrange
    const cause = new Error("Original error");

    // Act
    const error = new AppError("Public message", 500, { cause });

    // Assert
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("AppError");
    expect(error.message).toBe("Public message");
    expect(error.statusCode).toBe(500);
    expect(error.cause).toBe(cause);
    expect(error).not.toHaveProperty("isOperational");
  });
});

describe("AppError subclasses", () => {
  it.each([
    [BadRequestError, 400],
    [NotFoundError, 404],
    [PokeApiError, 502],
    [ValidationError, 502],
  ])("should configure %s correctly", (ErrorClass, expectedStatusCode) => {
    // Arrange
    const cause = new Error("Original error");

    // Act
    const error = new ErrorClass("Public message", { cause });

    // Assert
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe(ErrorClass.name);
    expect(error.message).toBe("Public message");
    expect(error.statusCode).toBe(expectedStatusCode);
    expect(error.cause).toBe(cause);
    expect(error).not.toHaveProperty("isOperational");
  });
});
