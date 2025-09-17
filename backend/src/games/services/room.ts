/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "../../lib/prisma";
import {
  Room,
  RoomStatus,
  RoomType,
  RoomWithGame,
  UserStatus,
  Game,
  GameStatus,
  TimeControl,
} from "../../lib/types";
import { WebSocketService } from "../../services/websocket";
import { GameService } from "./game";
import { BOT_PLAYER_ID, BOT_NAME } from "./bot";
import { logger } from "../../services/logger";
import { redis } from "../../services/redis";

export class RoomService {
  private ws: WebSocketService;
  private gameService: GameService;

  QUEUE_KEY = "matchmaking_queue";
  QUEUE_TIMEOUT = 30000;

  constructor(ws: WebSocketService, gameService: GameService) {
    this.ws = ws;
    this.gameService = gameService;
  }

  public async cleanupExpiredQueuePlayers(): Promise<void> {
    try {
      const now = Date.now();
      const expiredTimestamp = now - this.QUEUE_TIMEOUT;

      const expiredPlayers = await redis.zrangebyscore(
        this.QUEUE_KEY,
        0,
        expiredTimestamp
      );

      if (expiredPlayers.length > 0) {
        const removedCount = await redis.zrem(
          this.QUEUE_KEY,
          ...expiredPlayers
        );

        if (removedCount > 0) {
          logger.info(
            `Timed out and removed ${removedCount} players from matchmaking queue.`
          );

          for (const playerId of expiredPlayers) {
            await prisma.user
              .update({
                where: { id: playerId },
                data: { status: UserStatus.ONLINE },
              })
              .catch((err) =>
                logger.error(
                  `Failed to update status for expired player ${playerId}:`,
                  err
                )
              );

            this.ws.broadcastToClient(playerId, {
              type: "QUEUE_TIMED_OUT",
              payload: {
                message: "Matchmaking timed out. No opponent was found.",
              },
            });
          }
        }
      }
    } catch (error) {
      logger.error("Error during periodic queue cleanup:", error);
    }
  }

  async createBotGame(playerId: string): Promise<void> {
    try {
      logger.info(`Player ${playerId} is starting a game against the bot.`);

      const playerIsWhite = Math.random() > 0.5;
      const playerColor = playerIsWhite ? "white" : "black";
      const botColor = playerIsWhite ? "black" : "white";

      const chess = require("chess.js").Chess;
      const chessInstance = new chess();
      const initialFen = chessInstance.fen();

      const timeControl: TimeControl = {
        initial: 600,
        increment: 0,
      };

      await prisma.user.upsert({
        where: { id: BOT_PLAYER_ID },
        update: {},
        create: {
          id: BOT_PLAYER_ID,
          name: BOT_NAME,
          email: `${BOT_PLAYER_ID}@bot.local`,
          provider: "GUEST",
          banned: false,
          status: "ONLINE",
        },
      });

      const result = await prisma.$transaction(
        async (tx) => {
          const room = await tx.room.create({
            data: {
              type: RoomType.BOT,
              status: RoomStatus.OPEN,
              players: [
                { id: playerId, color: playerColor },
                { id: BOT_PLAYER_ID, name: BOT_NAME, color: botColor },
              ] as any,
            },
          });

          logger.info(`Bot game room ${room.id} created with players.`);

          const game = await tx.game.create({
            data: {
              roomId: room.id,
              fen: initialFen,
              moveHistory: [],
              timers: {
                white: timeControl.initial,
                black: timeControl.initial,
              },
              timeControl: timeControl as any,
              status: GameStatus.ACTIVE,
              chat: [],
              players: {
                create: [
                  { userId: playerId, color: playerColor },
                  { userId: BOT_PLAYER_ID, color: botColor },
                ],
              },
            },
            include: {
              players: true,
              Room: true,
            },
          });

          await tx.room.update({
            where: { id: room.id },
            data: { status: RoomStatus.ACTIVE },
          });

          return { room, game };
        },
        {
          maxWait: 10000,
          timeout: 15000,
        }
      );

      const users = await prisma.user.findMany({
        where: { id: { in: [playerId, BOT_PLAYER_ID] } },
        select: { id: true, name: true },
      });

      const userNameMap = new Map(users.map((u) => [u.id, u.name]));

      const formattedGame: Game = {
        id: result.game.id,
        roomId: result.game.roomId,
        fen: result.game.fen,
        moveHistory: result.game.moveHistory as any[],
        timers: result.game.timers as { white: number; black: number },
        timeControl: result.game.timeControl as unknown as TimeControl,
        status: result.game.status as GameStatus,
        players: result.game.players.map((p: any) => ({
          userId: p.userId,
          color: p.color,
          name: userNameMap.get(p.userId) || "Unknown Player",
        })),
        chat: result.game.chat as any[],
        winnerId: result.game.winnerId || undefined,
        createdAt: result.game.createdAt,
      };

      await redis.setJSON(`game:${result.game.id}`, formattedGame);

      await redis.del(`invalidMoves:${playerId}`);
      await redis.set(`player:${playerId}:lastGame`, result.game.id, {
        EX: 3600,
      });

      const roomWithGame: RoomWithGame = {
        id: result.room.id,
        type: result.room.type as RoomType,
        status: RoomStatus.ACTIVE,
        players: [
          { id: playerId, color: playerColor },
          { id: BOT_PLAYER_ID, color: botColor },
        ],
        inviteCode: result.room.inviteCode || undefined,
        createdAt: result.room.createdAt,
        game: formattedGame,
      };

      this.ws.broadcastToClient(playerId, {
        type: "ROOM_UPDATED",
        payload: roomWithGame,
      });

      this.gameService.addGameToTimer(result.game.id);

      if (botColor === "white") {
        setTimeout(async () => {
          try {
            await this.gameService.getBotService().onGameUpdate(formattedGame);
          } catch (error) {
            logger.error(
              `Failed to trigger bot's first move in game ${result.game.id}:`,
              error
            );
          }
        }, 500);
      }

      logger.info(
        `Bot game ${result.game.id} started successfully in room ${result.room.id}.`
      );
    } catch (error) {
      logger.error(`Failed to create bot game for player ${playerId}:`, error);

      // Send error message to client
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: {
          message: "Could not start a game against the bot. Please try again.",
        },
      });
    }
  }

  async createRoom(
    type: RoomType,
    playerId: string,
    inviteCode?: string
  ): Promise<void> {
    try {
      const room = await prisma.room.create({
        data: {
          type,
          status: RoomStatus.OPEN,
          players: [{ id: playerId, color: null }] as any,
          inviteCode,
        },
      });

      const roomData: Room = {
        id: room.id,
        type: room.type as RoomType,
        status: room.status as RoomStatus,
        players: (room.players as { id: string; color: string | null }[]) || [],
        inviteCode: room.inviteCode || undefined,
        createdAt: room.createdAt,
      };

      this.ws.broadcastToClient(playerId, {
        type: "ROOM_CREATED",
        payload: roomData,
      });

      logger.info(`Room ${room.id} created by player ${playerId}`);
    } catch (error) {
      logger.error("Error creating room:", error);
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: { message: "Failed to create room" },
      });
    }
  }

  async joinRoom(
    roomId: string,
    playerId: string,
    inviteCode?: string
  ): Promise<void> {
    try {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
      });

      if (!room) {
        this.ws.broadcastToClient(playerId, {
          type: "ERROR",
          payload: { message: "Room not found" },
        });
        return;
      }

      const roomData: Room = {
        id: room.id,
        type: room.type as RoomType,
        status: room.status as RoomStatus,
        players: (room.players as { id: string; color: string | null }[]) || [],
        inviteCode: room.inviteCode || undefined,
        createdAt: room.createdAt,
      };

      if (roomData.inviteCode && roomData.inviteCode !== inviteCode) {
        this.ws.broadcastToClient(playerId, {
          type: "ERROR",
          payload: { message: "Invalid invite code" },
        });
        return;
      }

      if (roomData.players.length >= 2) {
        this.ws.broadcastToClient(playerId, {
          type: "ERROR",
          payload: { message: "Room is full" },
        });
        return;
      }

      if (roomData.players.some((p) => p.id === playerId)) {
        this.ws.broadcastToClient(playerId, {
          type: "ERROR",
          payload: { message: "Already in this room" },
        });
        return;
      }

      roomData.players.push({ id: playerId, color: null });

      if (roomData.players.length === 2) {
        const colors = ["white", "black"];
        const shuffledColors = colors.sort(() => Math.random() - 0.5);
        roomData.players[0].color = shuffledColors[0];
        roomData.players[1].color = shuffledColors[1];
      }

      await prisma.room.update({
        where: { id: roomId },
        data: { players: roomData.players as any },
      });

      if (roomData.players.length === 2) {
        const game = await this.gameService.startGame(roomId);
        const roomWithGame: RoomWithGame = { ...roomData, game };
        this.ws.broadcastToRoom(roomWithGame);
      } else {
        this.ws.broadcastToRoom(roomData);
      }

      logger.info(`Player ${playerId} joined room ${roomId}`);
    } catch (error) {
      logger.error("Error joining room:", error);
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: { message: "Failed to join room" },
      });
    }
  }

  async leaveRoom(playerId: string, roomId: string): Promise<void> {
    try {
      const room = await prisma.room.findUnique({
        where: { id: roomId },
      });

      if (!room) return;

      const roomData: Room = {
        id: room.id,
        type: room.type as RoomType,
        status: room.status as RoomStatus,
        players: (room.players as { id: string; color: string | null }[]) || [],
        inviteCode: room.inviteCode || undefined,
        createdAt: room.createdAt,
      };

      roomData.players = roomData.players.filter((p) => p.id !== playerId);

      if (roomData.players.length === 0) {
        await prisma.room.delete({
          where: { id: roomId },
        });
      } else {
        await prisma.room.update({
          where: { id: roomId },
          data: { players: roomData.players as any },
        });
        this.ws.broadcastToRoom(roomData);
      }

      logger.info(`Player ${playerId} left room ${roomId}`);
    } catch (error) {
      logger.error("Error leaving room:", error);
    }
  }

  async joinQueue(playerId: string, isGuest: boolean): Promise<void> {
    try {
      const opponentCandidates = await redis.zrange(this.QUEUE_KEY, 0, 0);

      if (opponentCandidates.length > 0) {
        const opponentId = opponentCandidates[0];

        const removedCount = await redis.zrem(this.QUEUE_KEY, opponentId);

        if (removedCount > 0) {
          logger.info(`Match found between ${playerId} and ${opponentId}.`);
          await this.createMatch(playerId, opponentId);
          return;
        }
      }

      const now = Date.now();
      await prisma.user.update({
        where: { id: playerId },
        data: { status: UserStatus.WAITING },
      });
      await redis.zadd(this.QUEUE_KEY, now, playerId);

      const queueSize = await redis.zcard(this.QUEUE_KEY);
      this.ws.broadcastToClient(playerId, {
        type: "QUEUE_JOINED",
        payload: { isGuest, queueSize },
      });

      logger.info(
        `Player ${playerId} joined queue. Current size: ${queueSize}`
      );
    } catch (error) {
      logger.error("Error in joinQueue:", error);
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: { message: "Failed to join matchmaking." },
      });
    }
  }

  private async createMatch(
    playerOneId: string,
    playerTwoId: string
  ): Promise<void> {
    const players = [playerOneId, playerTwoId];
    const colors = ["white", "black"].sort(() => Math.random() - 0.5);

    await prisma.user.updateMany({
      where: { id: { in: players } },
      data: { status: UserStatus.IN_GAME },
    });

    const room = await prisma.room.create({
      data: {
        type: RoomType.PUBLIC,
        status: RoomStatus.OPEN,
        players: [
          { id: players[0], color: colors[0] },
          { id: players[1], color: colors[1] },
        ] as any,
      },
    });

    const game = await this.gameService.startGame(room.id);
    const roomWithGame: RoomWithGame = {
      id: room.id,
      type: room.type as RoomType,
      status: RoomStatus.ACTIVE,
      players: room.players as any,
      createdAt: room.createdAt,
      game,
    };

    this.ws.broadcastToRoom(roomWithGame);
  }

  async leaveQueue(playerId: string): Promise<void> {
    try {
      const removed = await redis.zrem(this.QUEUE_KEY, playerId);
      if (removed > 0) {
        await prisma.user.update({
          where: { id: playerId },
          data: { status: UserStatus.ONLINE },
        });
        this.ws.broadcastToClient(playerId, {
          type: "QUEUE_LEFT",
          payload: {},
        });
        logger.info(`Player ${playerId} left queue manually.`);
      }
    } catch (error) {
      logger.error("Error leaving queue:", error);
    }
  }

  handleDisconnect(ws: any): void {
    if (ws.playerId) {
      redis.zrem(this.QUEUE_KEY, ws.playerId);
      logger.info(
        `Player ${ws.playerId} disconnected, removing from queue if present.`
      );
    }
  }

  async handleRequestRejoin(playerId: string, gameId: string): Promise<void> {
    try {
      const gameData = await redis.get(`game:${gameId}`);

      if (!gameData) {
        this.ws.broadcastToClient(playerId, {
          type: "GAME_NOT_FOUND",
          payload: { message: "Game not found" },
        });
        return;
      }

      const game = JSON.parse(gameData);
      const isPlayerInGame = game.players.some(
        (p: any) => p.userId === playerId
      );

      if (!isPlayerInGame) {
        this.ws.broadcastToClient(playerId, {
          type: "UNAUTHORIZED",
          payload: { message: "Not authorized to rejoin this game" },
        });
        return;
      }

      this.ws.broadcastToClient(playerId, {
        type: "REJOIN_GAME",
        payload: game,
      });

      logger.info(`Player ${playerId} rejoined game ${gameId}`);
    } catch (error) {
      logger.error(
        `Error handling rejoin request for player ${playerId}, game ${gameId}:`,
        error
      );
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: { message: "Failed to rejoin game" },
      });
    }
  }
}
