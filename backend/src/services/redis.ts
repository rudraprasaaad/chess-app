import { createClient, RedisClientType } from "redis";
import { logger } from "./logger";

class RedisService {
  private static _instance: RedisService;
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL!,
    });

    this.client.on("error", (error) => {
      logger.error("Redis Error:", error);
    });

    this.client.on("connect", () => {
      this.isConnected = true;
      logger.info("Connected to Redis");
    });

    this.client.on("disconnect", () => {
      this.isConnected = false;
      logger.info("Disconnected from redis");
    });
  }

  public static get instance(): RedisService {
    if (!RedisService._instance) {
      RedisService._instance = new RedisService();
    }
    return RedisService._instance;
  }

  async connect(): Promise<void> {
    if (!this.isConnected) {
      await this.client.connect();
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.client.disconnect();
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (!this.isConnected) return;
    try {
      ttl
        ? await this.client.setEx(key, ttl, value)
        : await this.client.set(key, value);
    } catch (error) {
      logger.error("Redis SET error:", error);
    }
  }

  async get(key: string): Promise<string | null> {
    if (!this.isConnected) return null;
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error("Redis GET error:", error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error("Redis DEL error:", error);
    }
  }

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
      logger.error("JSON parse error:", error);
      return null;
    }
  }

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

  async cache(key: string, value: any, ttl: number = 300): Promise<void> {
    await this.setJSON(`cache:${key}`, value, ttl);
  }

  async getCache<T>(key: string): Promise<T | null> {
    return this.getJSON<T>(`cache:${key}`);
  }

  async lpush(key: string, value: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.lPush(key, value);
    } catch (error) {
      logger.error("Redis LPUSH error:", error);
    }
  }

  async rpop(key: string): Promise<string | null> {
    if (!this.isConnected) return null;
    try {
      return await this.client.rPop(key);
    } catch (error) {
      logger.error("Redis RPOP error:", error);
      return null;
    }
  }

  async publish(channel: string, message: string): Promise<void> {
    if (!this.isConnected) return;
    try {
      await this.client.publish(channel, message);
    } catch (error) {
      logger.error("Redis PUBLISH error:", error);
    }
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.client.ping();
      return result === "PONG";
    } catch (error) {
      return false;
    }
  }
}

export const redis = RedisService.instance;
