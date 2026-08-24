import internalServerErrorHandler from "../../../backend/src/middlewares/internal-server-error.handler.js";

it("should log the error and return a generic 500 response", () => {
  // Arrange
  const err = new Error("Unexpected error");
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  };

  const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  // Act
  internalServerErrorHandler(err, {}, res, {});

  // Assert
  expect(res.status).toHaveBeenCalledExactlyOnceWith(500);
  expect(res.json).toHaveBeenCalledExactlyOnceWith({
    message: "internal server error",
  });
  expect(consoleSpy).toHaveBeenCalledExactlyOnceWith(err);

  consoleSpy.mockRestore();
});
