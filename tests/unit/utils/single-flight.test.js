import { singleFlight } from "../../../backend/src/utils/single-flight.js";
import makePokemonDetails from "../../factories/pokemon-details.factory.js";

describe("singleFlight", () => {
  it("should execute and return the request result", async () => {
    // Arrange
    const request = vi.fn().mockResolvedValue(makePokemonDetails());

    // Act
    const result = await singleFlight("pokemon/1", request);

    // Assert
    expect(request).toHaveBeenCalledOnce();

    expect(result).toStrictEqual(makePokemonDetails());
  });

  it("should share the same request for concurrent calls", async () => {
    // Arrange
    let resolveRequest;

    const request = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveRequest = resolve;
        }),
    );

    // Act
    const promise1 = singleFlight("pokemon/1", request);
    const promise2 = singleFlight("pokemon/1", request);
    const promise3 = singleFlight("pokemon/1", request);

    // Assert while request is pending
    expect(request).toHaveBeenCalledOnce();

    // Finish request
    resolveRequest(makePokemonDetails());

    //Act
    const results = await Promise.all([promise1, promise2, promise3]);

    //Assert
    expect(results).toStrictEqual([
      makePokemonDetails(),
      makePokemonDetails(),
      makePokemonDetails(),
    ]);
  });

  it("should not share requests with different keys", async () => {
    //Arrange
    const request = vi.fn().mockResolvedValue({
      success: true,
    });

    //Act
    await Promise.all([
      singleFlight("pokemon/1", request),
      singleFlight("pokemon/2", request),
    ]);

    //Assert
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("should allow a new request after the previous one finishes", async () => {
    //Arrange
    const request = vi
      .fn()
      .mockResolvedValueOnce("first")
      .mockResolvedValueOnce("second");

    //Act
    const firstResult = await singleFlight("pokemon/1", request);
    const secondResult = await singleFlight("pokemon/1", request);

    //Assert
    expect(firstResult).toBe("first");
    expect(secondResult).toBe("second");

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("should propagate errors from the request", async () => {
    //Arrange
    const error = new Error("Request failed");

    const request = vi.fn().mockRejectedValue(error);

    //Act + Assert
    await expect(singleFlight("pokemon/1", request)).rejects.toThrow(error);

    //Assert
    expect(request).toHaveBeenCalledOnce();
  });

  it("should allow a new request after a failed request", async () => {
    //Arrange
    const request = vi
      .fn()
      .mockRejectedValueOnce(new Error("Request failed"))
      .mockResolvedValueOnce(makePokemonDetails());

    //Act + Assert
    await expect(singleFlight("pokemon/1", request)).rejects.toThrow(
      "Request failed",
    );

    //Act
    const result = await singleFlight("pokemon/1", request);

    //Assert
    expect(result).toStrictEqual(makePokemonDetails());

    expect(request).toHaveBeenCalledTimes(2);
  });

  it("should share the same failed request with concurrent callers", async () => {
    //Arrange
    let rejectRequest;

    const request = vi.fn(
      () =>
        new Promise((resolve, rejected) => {
          rejectRequest = rejected;
        }),
    );

    //Act
    const promises = Array.from({ length: 3 }, () =>
      singleFlight("pokemon/1", request),
    );

    // Assert while request is pending
    expect(request).toHaveBeenCalledOnce();

    // Finish request
    rejectRequest(new Error("Request failed"));

    //Act
    const results = await Promise.allSettled(promises);

    const verifyRejectedPromises = results.every(
      (result) => result.status === "rejected",
    );

    //Assert
    expect(results).toHaveLength(3);

    expect(verifyRejectedPromises).toBe(true);
  });
});
