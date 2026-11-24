import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { logger } from "../lib/logger";

export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
  }
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof ZodError) {
    return res
      .status(400)
      .json({ error: "VALIDATION_ERROR", details: err.issues });
  }
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (err instanceof Error && err.message === "INVALID_CREDENTIALS") {
    return res.status(401).json({ error: "INVALID_CREDENTIALS" });
  }

  logger.error(err);
  res.status(500).json({ error: "INTERNAL_ERROR" });
}
