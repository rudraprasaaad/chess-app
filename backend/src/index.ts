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

import { LoggerService } from "./services/logger";
import { DatabaseService } from "./services/database";
import { WebSocketService } from "./services/websocket";

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
  private database!: DatabaseService;
  private ws!: WebSocketService;
  public logger: LoggerService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.logger = new LoggerService();

    this.initializeDatabase();
    this.initializeWebSocket();
    this.initializeMiddleware();
    this.initializePassport();
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

  private initializePassport(): void {
    initPassport();
    this.app.use(passport.initialize());
    this.app.use(passport.session());
  }

  private initializeWebSocket(): void {
    // const allowedOrigin = process.env.FRONTEND_URL || "http://localhost:5173";

    this.wss = new WebSocketServer({
      server: this.server,
      // verifyClient: (info, done) => {
      //   const origin = info.origin;

      //   if (origin === allowedOrigin) done(true);
      //   else {
      //     this.logger.warn(`WebsocketServer rejected origin :${origin}`);
      //     done(false, 403, "Forbidden");
      //   }
      // },
    });
    this.ws = new WebSocketService(this.wss);
    this.app.set("websocket", this.ws); // making websocket available to all the routes.
    this.logger.info("Websocket server initialized");
  }

  private initializeMiddleware(): void {
    this.app.use(helmet());

    this.app.use(
      cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
        credentials: true,
      })
    );

    this.app.use(cookieParser());
    this.app.use(
      session({
        secret: process.env.COOKIE_SECRET!,
        resave: false,
        saveUninitialized: false,
        cookie: { secure: false, maxAge: COOKIE_MAX_AGE, httpOnly: true },
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
    this.app.use("/auth", authRoutes);

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
