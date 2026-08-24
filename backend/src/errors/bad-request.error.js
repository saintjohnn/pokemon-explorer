import AppError from "./app.error.js";

export default class BadRequestError extends AppError {
  constructor(message, options) {
    super(message, 400, options);
  }
}
