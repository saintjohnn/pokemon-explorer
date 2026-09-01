import { singleFlight } from "../../../backend/src/clients/single-flight";

it("should return the same promise for concurrent requests with the same key", () => {
  const request = vi.fn(
    () => new Promise((resolve) => setTimeout(resolve, 10)),
  );

  const promiseA = singleFlight("pokemon/1", request);
  const promiseB = singleFlight("pokemon/1", request);

  expect(promiseA).toBe(promiseB);
  expect(request).toHaveBeenCalledTimes(1);
});
