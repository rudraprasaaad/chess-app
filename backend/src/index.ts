import express from "express";
import { createServer } from "http";
import dotenv from "dotenv";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import session from "express-session";
import { WebSocketServer } from "ws";
import passport from "passport";

import { logger } from "./services/logger";
import { database } from "./services/database";
import { WebSocketService } from "./services/websocket";
import { redis } from "./services/redis";
import { swagger } from "./services/swagger";

import { requestLogger } from "./middleware/requestLogger";
import { errorHandler } from "./middleware/errorHandler";
import { initPassport } from "./middleware/passport";

import authRoutes from "./routes/auth";

import { COOKIE_MAX_AGE } from "./lib/consts";

dotenv.config({ path: "../.env" });

class Application {
  public app: express.Application;
  public server: any;
  public wss!: WebSocketServer;
  private ws!: WebSocketService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
  }

  public async init(): Promise<void> {
    await this.initializeDatabase();
    await this.initializeRedis();
    this.initializeWebSocket();
    this.initializeMiddleware();
    this.initializePassport();
    this.initializeSwagger();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  private async initializeDatabase(): Promise<void> {
    try {
      await database.connect();
      logger.info("Connected to PostgreSQL database");
    } catch (err) {
      logger.error("Failed to connect to database", err);
      process.exit(1);
    }
  }

  private async initializeRedis(): Promise<void> {
    try {
      await redis.connect();
      logger.info("Connected to Redis");
    } catch (err) {
      logger.error("Failed to connect to Redis:", err);
      process.exit(1);
    }
  }

  private initializePassport(): void {
    initPassport();
    this.app.use(passport.initialize());
    this.app.use(passport.session());
  }

  private initializeSwagger(): void {
    try {
      if (swagger.isEnabled()) {
        swagger.setupSwagger(this.app);
        logger.info("📖 Swagger documentation enabled");
      } else {
        logger.info("📖 Swagger documentation disabled in production");
      }
    } catch (err) {
      logger.error("Failed to initialize Swagger documentation:", err);
    }
  }

  private initializeWebSocket(): void {
    const isProduction = process.env.NODE_ENV === "production";
    const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

    this.wss = new WebSocketServer({
      server: this.server,
      verifyClient: (info, done) => {
        if (isProduction) {
          const origin = info.origin;
          if (origin === allowedOrigin) {
            done(true);
          } else {
            logger.warn(`WebSocket server rejected origin: ${origin}`);
            done(false, 403, "Forbidden");
          }
        } else {
          done(true);
        }
      },
    });

    this.ws = new WebSocketService(this.wss);
    this.app.set("websocket", this.ws);
    logger.info("WebSocket server initialized");
  }

  private initializeMiddleware(): void {
    const isProduction = process.env.NODE_ENV === "production";

    this.app.use(
      helmet({
        contentSecurityPolicy: isProduction ? undefined : false,
      })
    );

    this.app.use(
      cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "Cookie"],
      })
    );

    this.app.use(cookieParser());

    this.app.use(
      session({
        secret: process.env.COOKIE_SECRET!,
        resave: false,
        saveUninitialized: false,
        cookie: {
          secure: isProduction,
          maxAge: COOKIE_MAX_AGE,
          httpOnly: true,
          sameSite: isProduction ? "none" : "lax",
        },
      })
    );

    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: isProduction ? 200 : 100, // More lenient in production for real usage
      message: "Too many requests from this IP, please try again later.",
      standardHeaders: true,
      legacyHeaders: false,
    });

    this.app.use(limiter);

    this.app.use(express.json({ limit: "10mb" }));
    this.app.use(express.urlencoded({ extended: true, limit: "10mb" }));
    this.app.use(requestLogger);

    this.app.get("/api/health", async (_req, res) => {
      try {
        await database.client.$queryRaw`SELECT 1`;
        await redis.ping();

        res.json({
          status: "ok",
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
          environment: process.env.NODE_ENV,
          services: {
            database: "connected",
            redis: "connected",
            websocket: "active",
          },
        });
      } catch (err) {
        logger.error("Health check failed:", err);
        res.status(503).json({
          status: "error",
          timestamp: new Date().toISOString(),
          error: "Service unavailable",
        });
      }
    });
  }

  private initializeRoutes(): void {
    this.app.use("/auth", authRoutes);

    this.app.use("*", (req, res) => {
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
    const isProduction = process.env.NODE_ENV === "production";

    const host = isProduction ? "0.0.0.0" : "localhost";

    this.server.listen(port, host, () => {
      const baseUrl = isProduction
        ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}`
        : `http://localhost:${port}`;

      logger.info(`🚀 Server running on port ${port}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV}`);
      logger.info(`🔗 API URL: ${baseUrl}/`);
      logger.info(`🏥 Health Check: ${baseUrl}/api/health`);

      if (swagger.isEnabled()) {
        logger.info(`📖 API Documentation: ${baseUrl}/api-docs`);
      }

      if (isProduction) {
        logger.info(
          `🌐 WebSocket URL: wss://${
            process.env.RENDER_EXTERNAL_HOSTNAME || "chess-backend.onrender.com"
          }`
        );
      }
    });

    process.on("SIGTERM", this.gracefulShutdown.bind(this));
    process.on("SIGINT", this.gracefulShutdown.bind(this));
  }

  private async gracefulShutdown(): Promise<void> {
    logger.info("🛑 Starting graceful shutdown...");

    this.wss.close(() => {
      logger.info("🔌 WebSocket server closed");
    });

    this.server.close(() => {
      logger.info("🌐 HTTP server closed");
    });

    try {
      await database.disconnect();
      logger.info("🗄️ Database connection closed");
    } catch (err) {
      logger.error("❌ Error closing database connection:", err);
    }

    try {
      await redis.disconnect();
      logger.info("🔴 Redis connection closed");
    } catch (err) {
      logger.error("❌ Error closing Redis connection:", err);
    }

    logger.info("✅ Graceful shutdown completed");
    process.exit(0);
  }
}

const app = new Application();

app
  .init()
  .then(() => {
    app.listen();
  })
  .catch((error) => {
    logger.error("❌ Failed to initialize application:", error);
    process.exit(1);
  });

export default app;
