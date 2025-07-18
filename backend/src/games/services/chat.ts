import { InputJsonValue, JsonValue } from "@prisma/client/runtime/library";

import { prisma } from "../../lib/prisma";
import { Game, GameStatus } from "../../lib/types";

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

    if (limit.count >= 0) {
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

    const message = {
      playerId,
      text: text.trim(),
      timestamp: Date.now(),
    };

    const chat = [...(gameRaw.chat || []), message];

    const updatedGame = await prisma.game.update({
      where: {
        id: gameId,
      },
      data: {
        chat: chat as InputJsonValue[],
      },
      include: { players: true },
    });

    const formattedGame: Game = {
      id: updatedGame.id,
      roomId: updatedGame.roomId,
      fen: updatedGame.fen,
      moveHistory: updatedGame.moveHistory,
      timers: updatedGame.timers as { white: number; black: number },
      status: updatedGame.status as GameStatus,
      players: updatedGame.players.map((p) => ({
        userId: p.userId,
        color: p.color,
      })),
      chat: updatedGame.chat,
      winnerId: updatedGame.winnerId || undefined,
      createdAt: updatedGame.createdAt,
    };

    await redis.setJSON(`game:${gameId}`, formattedGame);
    this.ws.broadcastToGame(formattedGame);
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

  async getChatHistory(gameId: string, playerId: string): Promise<JsonValue[]> {
    const gameData = await redis.get(`game:${gameId}`);
    if (!gameData) throw new Error("Game not found");

    const gameRaw = JSON.parse(gameData) as Game;
    if (!gameRaw.players.some((p) => p.userId === playerId)) {
      throw new Error("Player not in game");
    }

    return gameRaw.chat || [];
  }
}
