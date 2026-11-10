import mapPokemonTypes from "../../../backend/src/mappers/pokemon/pokemon-types.mapper.js"

describe("mapPokemonTypes", () => {
	it("should extract type names preserving their order", () => {
		// Arrange
		const types = [{ type: { name: "grass" } }, { type: { name: "poison" } }]

		// Act
		const result = mapPokemonTypes(types)

		// Assert
		expect(result).toStrictEqual(["grass", "poison"])
	})

	it("should return an empty array for an empty input", () => {
		// Arrange
		const types = []

		// Act
		const result = mapPokemonTypes(types)

		// Assert
		expect(result).toStrictEqual([])
	})
})
