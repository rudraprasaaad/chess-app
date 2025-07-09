import { PrimaryExpression } from "typescript";
import { PrismaClient } from "../generated/prisma";
import { LoggerService } from "./logger";

export class DatabaseService {
  private prisma: PrismaClient;
  private logger: LoggerService;

  constructor() {
    this.prisma = new PrismaClient({
      log: ["query", "info", "warn", "error"],
    });
    this.logger = new LoggerService();
  }

  async connect(): Promise<void> {
    try {
      await this.prisma.$connect();
      this.logger.info("Connected to PostgresSQL Server");
    } catch (err) {
      this.logger.error("Failed to connect to database:", err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.prisma.$disconnect();
      this.logger.info("Disconnected from PostgresSQL database");
    } catch (err) {
      this.logger.error("Error disconnecting from database", err);
      throw err;
    }
  }

  get client(): PrismaClient {
    return this.prisma;
  }

  get user() {
    return this.prisma.user;
  }

  async isHealthy(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      this.logger.error("Database health check failed", err);
      return false;
    }
  }
}

export const database = new DatabaseService();
