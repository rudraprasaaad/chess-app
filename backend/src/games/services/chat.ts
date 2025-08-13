import { ChatMessage, Game } from "../../lib/types";

import { redis } from "../../services/redis";
import { WebSocketService } from "../../services/websocket";

export class ChatService {
  private ws: WebSocketService;
  private messageRateLimit: Map<string, { count: number; lastReset: number }>;

  constructor(ws: WebSocketService) {
    this.ws = ws;
    this.messageRateLimit = new Map();
  }

  private checkRateLimit(playerId: string): void {
    const now = Date.now();
    const limit = this.messageRateLimit.get(playerId) || {
      count: 0,
      lastReset: now,
    };

    if (now - limit.lastReset > 60000) {
      limit.count = 0;
      limit.lastReset = now;
    }

    if (limit.count >= 50) {
      throw new Error(
        "Rate limit exceeded. Please wait before sending more messages."
      );
    }

    limit.count++;
    this.messageRateLimit.set(playerId, limit);
  }

  async sendChatMessage(
    gameId: string,
    playerId: string,
    text: string
  ): Promise<void> {
    if (!gameId || !playerId || !text) {
      throw new Error("Invalid input: gameId, playerId, and text are requried");
    }

    if (text.trim().length === 0) {
      throw new Error("Message cannot be empty");
    }

    if (text.length > 500) {
      throw new Error("Message too long (max 500 characters)");
    }

    this.checkRateLimit(playerId);

    const gameData = await redis.get(`game:${gameId}`);
    if (!gameData) throw new Error("Game not found");

    const gameRaw = JSON.parse(gameData) as Game;
    if (!gameRaw.players.some((p) => p.userId === playerId)) {
      throw new Error("Player not in game");
    }

    const message: ChatMessage = {
      playerId,
      text: text.trim(),
      timestamp: Date.now(),
    };

    gameRaw.chat.push(message);

    await redis.setJSON(`game:${gameId}`, gameRaw);
    this.ws.broadcastToGame(gameRaw);
  }

  async broadCastTyping(gameId: string, playerId: string): Promise<void> {
    const gameData = await redis.get(`game:${gameId}`);
    if (!gameData) throw new Error("Game not found");

    const gameRaw = JSON.parse(gameData) as Game;
    if (!gameRaw.players.some((p) => p.userId === playerId)) {
      throw new Error("Player not in game");
    }

    gameRaw.players.forEach((player) => {
      if (player.userId !== playerId) {
        this.ws.broadcastToClient(player.userId, {
          type: "TYPING",
          payload: { gameId, playerId },
        });
      }
    });
  }

  async getChatHistory(
    gameId: string,
    playerId: string
  ): Promise<ChatMessage[]> {
    const gameData = await redis.get(`game:${gameId}`);
    if (!gameData) throw new Error("Game not found");

    const gameRaw = JSON.parse(gameData) as Game;
    if (!gameRaw.players.some((p) => p.userId === playerId)) {
      throw new Error("Player not in game");
    }

    return gameRaw.chat || [];
  }
}
