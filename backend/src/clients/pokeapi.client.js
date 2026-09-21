import PokeApiError from "../errors/poke-api.error.js";
import { createPokeApiUrl } from "../utils/pokeapi-url.js";
import { singleFlight } from "../utils/single-flight.js";

const requestTimeoutMs = 10_000;

export default async function pokeApi(pathOrUrl) {
  const url = createPokeApiUrl(pathOrUrl);

  return singleFlight(url.toString(), async () => {
    const response = await fetch(url, {
      redirect: "error",
      signal: AbortSignal.timeout(requestTimeoutMs),
    });

    if (!response.ok) {
      throw new PokeApiError(
        `PokeAPI responded with status ${response.status}`,
      );
    }

    return response.json();
  });
}
