import { prisma } from "../lib/prisma";
import { logger } from "./logger";

export class DatabaseService {
  async connect(): Promise<void> {
    try {
      await prisma.$connect();
      logger.info("Connected to PostgresSQL Server");
    } catch (err) {
      logger.error("Failed to connect to database:", err);
      throw err;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await prisma.$disconnect();
      logger.info("Disconnected from PostgresSQL database");
    } catch (err) {
      logger.error("Error disconnecting from database", err);
      throw err;
    }
  }

  get client() {
    return prisma;
  }

  get user() {
    return prisma.user;
  }

  async isHealthy(): Promise<boolean> {
    try {
      await prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      logger.error("Database health check failed", err);
      return false;
    }
  }
}

export const database = new DatabaseService();
