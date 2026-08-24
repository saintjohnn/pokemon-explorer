import AppError from "../errors/app.error.js";
import getBodyParserError from "../errors/body-parser-error.js";

export default function errorHandler(err, req, res, next) {
  const bodyParserError = getBodyParserError(err?.type);

  if (bodyParserError) {
    return res.status(bodyParserError.statusCode).json({
      message: bodyParserError.message,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
    });
  }

  return next(err);
}
