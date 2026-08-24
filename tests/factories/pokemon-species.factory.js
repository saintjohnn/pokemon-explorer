const defaultFlavorText =
  "A strange seed was planted on its back at birth.\fThe plant sprouts and grows with this POKéMON.";

export default function makePokemonSpecies({
  flavorText = defaultFlavorText,
  ...languageOverrides
} = {}) {
  return {
    flavor_text_entries: [
      {
        flavor_text: flavorText,
        language: {
          name: "en",
          ...languageOverrides,
        },
      },
    ],
  };
}
