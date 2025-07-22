import winston from "winston";

export class LoggerService {
  private logger: winston.Logger;

  constructor() {
    const isProduction = process.env.NODE_ENV === "production";

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || "info",
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        isProduction ? winston.format.simple() : winston.format.json()
      ),
      defaultMeta: { service: "chess-app-backend" },
      transports: [
        new winston.transports.Console({
          format: winston.format.combine(
            isProduction ? winston.format.simple() : winston.format.colorize(),
            winston.format.printf(
              ({ timestamp, level, message, service, ...meta }) => {
                const metaStr =
                  Object.keys(meta).length > 0
                    ? ` ${JSON.stringify(meta)}`
                    : "";
                return `${timestamp} [${level.toUpperCase()}] ${service}: ${message}${metaStr}`;
              }
            )
          ),
        }),
        ...(isProduction
          ? []
          : [
              new winston.transports.File({
                filename: "logs/error.log",
                level: "error",
              }),
              new winston.transports.File({
                filename: "logs/combined.log",
              }),
            ]),
      ],
    });
  }

  info(message: string, meta?: any): void {
    this.logger.info(message, meta);
  }

  error(message: string, error?: any): void {
    this.logger.error(message, error);
  }

  warn(message: string, meta?: any): void {
    this.logger.warn(message, meta);
  }

  debug(message: string, meta?: any): void {
    this.logger.debug(message, meta);
  }

  http(message: string, meta: any): void {
    this.logger.http(message, meta);
  }
}

export const logger = new LoggerService();
