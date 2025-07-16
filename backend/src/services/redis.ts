import { createClient, RedisClientType } from "redis";
import { LoggerService } from "./logger";

export class RedisService {
  private client: RedisClientType;
  private logger: LoggerService;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL!,
    });

    this.logger = new LoggerService();

    this.client.on("error", (error) => {
      this.logger.error("Redis Error:", error);
    });

    this.client.on("connect", () => {
      this.isConnected = true;
      this.logger.info("Connected to Redis");
    });

    this.client.on("disconnect", () => {
      this.isConnected = false;
      this.logger.info("Disconnected from redis");
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
    } catch (error) {
      this.logger.error("Failed to connect to Redis:", error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
    } catch (error) {
      this.logger.error("Error disconnecting from Redis:", error);
      throw error;
    }
  }

  // Key-value operations
  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isConnected) return;

    try {
      if (ttl) {
        await this.client.setEx(key, ttl, value);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      this.logger.error("Redis SET error:", error);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) return null;

    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error("Redis GET error:", error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.del(key);
    } catch (error) {
      this.logger.error("Redis DEL error:", error);
    }
  }

  // JSON operations
  async setJSON(key: string, value: any, ttl?: number): Promise<void> {
    const jsonValue = JSON.stringify(value);
    await this.set(key, jsonValue, ttl);
  }

  async getJSON<T>(key: string): Promise<T | null> {
    const value = await this.get(key);
    if (!value) return null;

    try {
      return JSON.parse(value) as T;
    } catch (error) {
      this.logger.error("JSON parse error:", error);
      return null;
    }
  }

  // Session management
  async setSession(
    sessionId: string,
    data: any,
    ttl: number = 3600
  ): Promise<void> {
    await this.setJSON(`session:${sessionId}`, data, ttl);
  }

  async getSession<T>(sessionId: string): Promise<T | null> {
    return this.getJSON<T>(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  // Cache operations
  async cache(key: string, value: any, ttl: number = 300): Promise<void> {
    await this.setJSON(`cache:${key}`, value, ttl);
  }

  async getCache<T>(key: string): Promise<T | null> {
    return this.getJSON<T>(`cache:${key}`);
  }

  // List operations
  async lpush(key: string, value: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.lPush(key, value);
    } catch (error) {
      this.logger.error("Redis LPUSH error:", error);
    }
  }

  async rpop(key: string): Promise<string | null> {
    if (!this.isConnected) return null;

    try {
      return await this.client.rPop(key);
    } catch (error) {
      this.logger.error("Redis RPOP error:", error);
      return null;
    }
  }

  // Pub/Sub operations
  async publish(channel: string, message: string): Promise<void> {
    if (!this.isConnected) return;

    try {
      await this.client.publish(channel, message);
    } catch (error) {
      this.logger.error("Redis PUBLISH error:", error);
    }
  }

  // Health check
  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch (error) {
      return false;
    }
  }
}
