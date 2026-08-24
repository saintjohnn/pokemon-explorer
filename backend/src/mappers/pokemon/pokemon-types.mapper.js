export default function mapPokemonTypes(types) {
  return types.map(({ type }) => type.name);
}
