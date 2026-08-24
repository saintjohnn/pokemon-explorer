import AppError from "./app.error.js";

export default class PokeApiError extends AppError {
  constructor(message, options) {
    super(message, 502, options);
  }
}
