import getBodyParserError from "../../../backend/src/errors/body-parser-error.js";

describe("getBodyParserError", () => {
  it.each([
    ["entity.parse.failed", 400, "Invalid JSON payload"],
    ["entity.too.large", 413, "Payload too large"],
    ["request.size.invalid", 400, "Invalid request size"],
    ["charset.unsupported", 415, "Unsupported charset"],
    ["encoding.unsupported", 415, "Unsupported content encoding"],
  ])("should resolve %s", (type, statusCode, message) => {
    expect(getBodyParserError(type)).toStrictEqual({ statusCode, message });
  });

  it.each([undefined, null, "unknown.error", "toString", "constructor"])(
    "should return undefined for an unregistered type: %j",
    (type) => {
      expect(getBodyParserError(type)).toBeUndefined();
    },
  );
});
