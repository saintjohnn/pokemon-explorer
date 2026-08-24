const bodyParserErrors = {
  "entity.parse.failed": {
    statusCode: 400,
    message: "Invalid JSON payload",
  },
  "entity.too.large": {
    statusCode: 413,
    message: "Payload too large",
  },
  "request.size.invalid": {
    statusCode: 400,
    message: "Invalid request size",
  },
  "charset.unsupported": {
    statusCode: 415,
    message: "Unsupported charset",
  },
  "encoding.unsupported": {
    statusCode: 415,
    message: "Unsupported content encoding",
  },
};

export default function getBodyParserError(type) {
  return Object.hasOwn(bodyParserErrors, type)
    ? bodyParserErrors[type]
    : undefined;
}
