const baseURL = new URL("https://pokeapi.co/api/v2/");

function isAllowedPokeApiLocation(url) {
  return (
    url.origin === baseURL.origin &&
    url.pathname.startsWith(baseURL.pathname) &&
    !url.username &&
    !url.password
  );
}

export function isAllowedPokeApiUrl(value) {
  if (typeof value !== "string") {
    return false;
  }

  const url = URL.parse(value);

  return url !== null && isAllowedPokeApiLocation(url);
}

export function createPokeApiUrl(pathOrUrl) {
  if (typeof pathOrUrl !== "string" || pathOrUrl.trim() === "") {
    throw new TypeError("PokeAPI URL must be a non-empty string");
  }

  const url = URL.parse(pathOrUrl, baseURL);

  if (url === null || !isAllowedPokeApiLocation(url)) {
    throw new TypeError("PokeAPI URL is not allowed");
  }

  return url;
}
