import { HttpError } from "../utils/httpError.js";

export function notFound(req, res) {
  res.status(404).json({ error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.originalUrl}` } });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }
  if (err && err.code === 11000) {
    return res.status(409).json({ error: { code: "DUPLICATE", message: "That value is already in use." } });
  }
  if (err && err.name === "ValidationError") {
    return res.status(400).json({ error: { code: "VALIDATION", message: err.message } });
  }
  console.error(err); // unexpected error: log full detail server-side, hide it from the client
  res.status(500).json({ error: { code: "INTERNAL", message: "Something went wrong." } });
}
