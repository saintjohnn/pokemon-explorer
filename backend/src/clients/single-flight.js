const inFlightRequests = new Map();

export function singleFlight(key, request) {
  const url = key.toString();

  const existingRequest = inFlightRequests.get(url);

  if (existingRequest) {
    return existingRequest;
  }

  const promise = request().finally(() => {
    inFlightRequests.delete(url);
  });

  inFlightRequests.set(url, promise);

  return promise;
}
