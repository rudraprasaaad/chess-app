import { NextFunction, Request, Response } from "express";
import { LoggerService } from "../services/logger";

const logger = new LoggerService();

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  logger.http("Incoming request", {
    method: req.method,
    url: req.url,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    timestamp: new Date().toISOString(),
  });

  // implementation of method interception or monkey patching
  // as our middleware needs to log information after the response
  // is complete, but there's no direct response event.
  // saving the original method
  // replacing with our own method
  const originalEnd = res.end as (...args: any[]) => Response;
  res.end = function (this: Response, ...args: any[]): Response {
    const duration = Date.now() - startTime;

    logger.http("Request completed", {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      contentLength: res.get("Content-Length") || 0,
      ip: req.ip,
    });

    originalEnd.apply(this, args);
    return this;
  };

  next();
};

export const errorOnlyRequestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const startTime = Date.now();

  const originalEndErrorLogger = res.end as (...args: any[]) => Response;
  res.end = function (this: Response, ...args: any[]): Response {
    const duration = Date.now() - startTime;

    if (res.statusCode >= 400) {
      logger.error("Request error", {
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration: `${duration}ms`,
        ip: req.ip,
        userAgent: req.get("User-Agent"),
        body: req.body,
      });
    }

    originalEndErrorLogger.apply(this, args);
    return this;
  };

  next();
};
