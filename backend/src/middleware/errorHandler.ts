/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextFunction, Request, Response } from "express";
import { logger } from "../services/logger";

export interface ApiError extends Error {
  statusCode?: number;
  details?: any;
}

export const errorHandler = (
  error: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error("API Error", {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });

  let statusCode = error.statusCode || 500;
  let message = error.message || "Internal Server Error";
  const details = error.details;

  if (error.name === "ValidationError") {
    statusCode = 400;
    message = "Validation Error";
  } else if (error.name === "UnauthorizedError") {
    statusCode = 401;
    message = "Unauthorized";
  } else if (error.name === "CastError") {
    statusCode = 400;
    message = "Invalid ID format";
  } else if (error.name === "PrismaError" && (error as any).code === 11000) {
    statusCode = 409;
    message = "Duplicate Entry";
  }

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(details && { details }),
    ...(process.env.NODE_ENV === "developement" && { stack: error.stack }),
  });
};

export const notFoundHandler = (
  req: Request,
  _res: Response,
  next: NextFunction
) => {
  const error = new Error(`Route ${req.originalUrl} not found`) as ApiError;
  error.statusCode = 404;
  next(error);
};

export const asyncHandler =
  (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
