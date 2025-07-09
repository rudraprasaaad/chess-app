import express from "express";
import { createServer } from "http";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

import { LoggerService } from "./services/logger";

import { requestLogger } from "./middleware/requestLogger";
import { errorHandler } from "./middleware/errorHandler";
import { DatabaseService } from "./services/database";

dotenv.config({ path: "../.env" });
class Application {
  public app: express.Application;
  public server: any;
  private database!: DatabaseService;
  public logger: LoggerService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.logger = new LoggerService();

    this.initializeDatabase();
    this.initializeMiddleware();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      this.database = new DatabaseService();
      await this.database.connect();
      this.logger.info("Connected to PostgresSQL database");
    } catch (err) {
      this.logger.error("Failed to connect to database", err);
      process.exit(1);
    }
  }

  private initializeMiddleware(): void {
    this.app.use(helmet());

    this.app.use(
      cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5371",
        credentials: true,
      })
    );

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 100,
      message: "Too many requests from this IP, please try again later.",
    });

    this.app.use(limiter);

    this.app.use(
      express.json({
        limit: "10mb",
      })
    );

    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));

    this.app.use(requestLogger);

    this.app.get("/api/health", (_req, res) => {
      res.json({
        status: "ok",
        timtestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environnment: process.env.NODE_ENV,
      });
    });
  }

  private initializeRoutes(): void {
    this.app.use("/{*any}", (req, res) => {
      res.status(404).json({
        error: "Route not found",
        message: `The requested route ${req.originalUrl} does not exist`,
      });
    });
  }

  private initializeErrorHandling(): void {
    this.app.use(errorHandler);
  }

  public listen(): void {
    const port = process.env.PORT || 4000;
    this.server.listen(port, () => {
      this.logger.info(`🚀 Server running on port ${port}`);
      this.logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      this.logger.info(`🔗 API URL: http://localhost:${port}/api`);
    });

    process.on("SIGTERM", this.gracefulShutdown.bind(this));
    process.on("SIGINT", this.gracefulShutdown.bind(this));
  }

  private async gracefulShutdown(): Promise<void> {
    this.logger.info("Starting graceful shutdown....");

    this.server.close(() => {
      this.logger.info("HTTP sever closed");
    });

    process.exit(0);
  }
}

const app = new Application();
app.listen();

export default app;
