import errorHandler from "../../../backend/src/middlewares/app-error.handler.js";
import NotFoundError from "../../../backend/src/errors/not-found.error.js";

describe("errorHandler", () => {
  it("should return the custom error response", () => {
    // Arrange
    const err = new NotFoundError("Pokemon not found");
    const req = {};
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    };
    const next = vi.fn();

    // Act
    errorHandler(err, req, res, next);

    // Assert
    expect(res.status).toHaveBeenCalledExactlyOnceWith(404);
    expect(res.json).toHaveBeenCalledExactlyOnceWith({
      message: err.message,
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should not expose an unknown error that imitates an operational error", () => {
    // Arrange
    const err = {
      statusCode: 418,
      message: "Internal implementation detail",
      isOperational: true,
    };
    const next = vi.fn();

    // Act
    errorHandler(err, {}, {}, next);

    // Assert
    expect(next).toHaveBeenCalledExactlyOnceWith(err);
  });

  it.each([
    ["entity.parse.failed", 400, "Invalid JSON payload"],
    ["entity.too.large", 413, "Payload too large"],
    ["request.size.invalid", 400, "Invalid request size"],
    ["charset.unsupported", 415, "Unsupported charset"],
    ["encoding.unsupported", 415, "Unsupported content encoding"],
  ])(
    "should normalize the body parser error %s",
    (type, expectedStatusCode, expectedMessage) => {
      // Arrange
      const err = { type, message: "Internal parser details" };
      const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };
      const next = vi.fn();

      // Act
      errorHandler(err, {}, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledExactlyOnceWith(expectedStatusCode);
      expect(res.json).toHaveBeenCalledExactlyOnceWith({
        message: expectedMessage,
      });
      expect(next).not.toHaveBeenCalled();
    },
  );

  it("should forward an unknown error to the next middleware", () => {
    // Arrange
    const err = new Error("Unexpected");
    const next = vi.fn();

    // Act
    errorHandler(err, {}, {}, next);

    // Assert
    expect(next).toHaveBeenCalledExactlyOnceWith(err);
  });
});
