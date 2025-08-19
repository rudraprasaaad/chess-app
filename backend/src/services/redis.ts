/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient, RedisClientType } from "redis";
import { logger } from "./logger";

class RedisService {
  private static _instance: RedisService;
  private client: RedisClientType;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.client = createClient({
      url: process.env.REDIS_URL!,
      socket: {
        connectTimeout: 60000,
        reconnectStrategy: (retries) => {
          if (retries >= this.maxReconnectAttempts) {
            logger.error("Max Redis reconnection attempts reached");
            return false;
          }
          this.reconnectAttempts = retries;
          return Math.min(retries * 100, 3000);
        },
      },
    });

    this.client.on("error", (error) => {
      logger.error("Redis Error:", error);
      this.isConnected = false;
    });

    this.client.on("connect", () => {
      this.isConnected = true;
      this.reconnectAttempts = 0;
      logger.info("Connected to Redis");
    });

    this.client.on("disconnect", () => {
      this.isConnected = false;
      logger.info("Disconnected from Redis");
    });

    this.client.on("reconnecting", () => {
      logger.info("Reconnecting to Redis...");
    });

    this.client.on("ready", () => {
      this.isConnected = true;
      logger.info("Redis client ready");
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
      try {
        await this.client.connect();
      } catch (error) {
        logger.error("Failed to connect to Redis:", error);
        throw error;
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      try {
        await this.client.disconnect();
      } catch (error) {
        logger.error("Failed to disconnect from Redis:", error);
      }
    }
  }

  private async ensureConnection(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  async set(
    key: string,
    value: string,
    options?: { EX?: number; NX?: boolean }
  ): Promise<void> {
    await this.ensureConnection();
    try {
      if (options) {
        await this.client.set(key, value, options);
      } else {
        await this.client.set(key, value);
      }
    } catch (error) {
      logger.error("Redis SET error:", error);
    }
  }

  async get(key: string): Promise<string | null> {
    await this.ensureConnection();
    try {
      return await this.client.get(key);
    } catch (error) {
      logger.error("Redis GET error:", error);
      return null;
    }
  }

  async del(key: string): Promise<void> {
    await this.ensureConnection();
    try {
      await this.client.del(key);
    } catch (error) {
      logger.error("Redis DEL error:", error);
    }
  }

  async expire(key: string, ttl: number): Promise<void> {
    await this.ensureConnection();
    try {
      await this.client.expire(key, ttl);
    } catch (error) {
      logger.error("Redis EXPIRE error:", error);
    }
  }

  async incr(key: string): Promise<number> {
    await this.ensureConnection();
    try {
      return await this.client.incr(key);
    } catch (error) {
      logger.error("Redis INCR error:", error);
      return 0;
    }
  }

  async ping(): Promise<string> {
    await this.ensureConnection();
    try {
      return await this.client.ping();
    } catch (error) {
      logger.error("Redis PING error:", error);
      throw error;
    }
  }

  async lpush(key: string, value: string): Promise<void> {
    await this.ensureConnection();
    try {
      await this.client.lPush(key, value);
    } catch (error) {
      logger.error("Redis LPUSH error:", error);
    }
  }

  async lpop(key: string, count?: number): Promise<string | string[] | null> {
    await this.ensureConnection();
    try {
      if (!count || count === 1) {
        return await this.client.lPop(key);
      } else {
        const results: string[] = [];
        for (let i = 0; i < count; i++) {
          const item = await this.client.lPop(key);
          if (item === null) break;
          results.push(item);
        }
        return results.length > 0 ? results : null;
      }
    } catch (error) {
      logger.error("Redis LPOP error:", error);
      return null;
    }
  }

  async rpop(key: string): Promise<string | null> {
    await this.ensureConnection();
    try {
      return await this.client.rPop(key);
    } catch (error) {
      logger.error("Redis RPOP error:", error);
      return null;
    }
  }

  async llen(key: string): Promise<number> {
    await this.ensureConnection();
    try {
      return await this.client.lLen(key);
    } catch (error) {
      logger.error("Redis LLEN error:", error);
      return 0;
    }
  }

  async lrange(key: string, start: number, stop: number): Promise<string[]> {
    await this.ensureConnection();
    try {
      return await this.client.lRange(key, start, stop);
    } catch (error) {
      logger.error("Redis LRANGE error:", error);
      return [];
    }
  }

  async lrem(key: string, count: number, element: string): Promise<number> {
    await this.ensureConnection();
    try {
      return await this.client.lRem(key, count, element);
    } catch (error) {
      logger.error("Redis LREM error:", error);
      return 0;
    }
  }

  async zadd(key: string, score: number, member: string): Promise<void> {
    await this.ensureConnection();
    try {
      await this.client.zAdd(key, { score, value: member });
    } catch (error) {
      logger.error("Redis ZADD error:", error);
    }
  }

  async zrangebyscore(
    key: string,
    min: number,
    max: number,
    options?: { LIMIT?: { offset: number; count: number } }
  ): Promise<string[]> {
    await this.ensureConnection();
    try {
      return await this.client.zRangeByScore(key, min, max, options);
    } catch (error) {
      logger.error("Redis ZRANGEBYSCORE error:", error);
      return [];
    }
  }

  async zrem(key: string, member: string): Promise<void> {
    await this.ensureConnection();
    try {
      await this.client.zRem(key, member);
    } catch (error) {
      logger.error("Redis ZREM error:", error);
    }
  }

  async publish(channel: string, message: string): Promise<void> {
    await this.ensureConnection();
    try {
      await this.client.publish(channel, message);
    } catch (error) {
      logger.error("Redis PUBLISH error:", error);
    }
  }

  async subscribe(
    channel: string,
    callback: (message: string) => void
  ): Promise<void> {
    await this.ensureConnection();
    try {
      await this.client.subscribe(channel, callback);
    } catch (error) {
      logger.error("Redis SUBSCRIBE error:", error);
    }
  }

  async unsubscribe(channel: string): Promise<void> {
    await this.ensureConnection();
    try {
      await this.client.unsubscribe(channel);
    } catch (error) {
      logger.error("Redis UNSUBSCRIBE error:", error);
    }
  }

  async setJSON(key: string, value: any, ttl?: number): Promise<void> {
    const jsonValue = JSON.stringify(value);
    if (ttl) {
      await this.set(key, jsonValue, { EX: ttl });
    } else {
      await this.set(key, jsonValue);
    }
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

  async watch(key: string): Promise<void> {
    await this.ensureConnection();
    try {
      await this.client.watch(key);
    } catch (err) {
      logger.error("Redis WATCH error:", err);
      throw err;
    }
  }

  async unwatch(): Promise<void> {
    await this.ensureConnection();
    try {
      await this.client.unwatch();
    } catch (err) {
      logger.error("Redis UNWATCH error:", err);
    }
  }

  async multi(): Promise<ReturnType<RedisClientType["multi"]>> {
    await this.ensureConnection();
    return this.client.multi();
  }

  async exec(
    multi: ReturnType<RedisClientType["multi"]>
  ): Promise<any[] | null> {
    await this.ensureConnection();
    try {
      return await multi.exec();
    } catch (err) {
      logger.error("Redis EXEC error:", err);
      return null;
    }
  }

  async setSession(sessionId: string, data: any, ttl = 3600): Promise<void> {
    await this.setJSON(`session:${sessionId}`, data, ttl);
  }

  async getSession<T>(sessionId: string): Promise<T | null> {
    return this.getJSON<T>(`session:${sessionId}`);
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.del(`session:${sessionId}`);
  }

  async cache(key: string, value: any, ttl = 300): Promise<void> {
    await this.setJSON(`cache:${key}`, value, ttl);
  }

  async getCache<T>(key: string): Promise<T | null> {
    return this.getJSON<T>(`cache:${key}`);
  }

  async isHealthy(): Promise<boolean> {
    try {
      const result = await this.ping();
      return result === "PONG";
    } catch {
      return false;
    }
  }
}

export const redis = RedisService.instance;
