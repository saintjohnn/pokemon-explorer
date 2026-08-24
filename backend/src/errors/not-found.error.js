import AppError from "./app.error.js";

export default class NotFoundError extends AppError {
  constructor(message, options) {
    super(message, 404, options);
  }
}
