const inFlightRequests = new Map();

export function singleFlight(key, request) {
  const existingRequest = inFlightRequests.get(key);

  if (existingRequest) {
    return existingRequest;
  }

  const promise = request().finally(() => {
    inFlightRequests.delete(key);
  });

  inFlightRequests.set(key, promise);

  return promise;
}
