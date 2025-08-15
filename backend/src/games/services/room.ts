/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from "../../lib/prisma";
import {
  Room,
  Game,
  AuthenticatedWebSocket,
  UserStatus,
  RoomType,
  RoomStatus,
  GameStatus,
  Move,
  ChatMessage,
  TimeControl,
} from "../../lib/types";

import { GameService } from "./game";

import { redis } from "../../services/redis";
import { WebSocketService } from "../../services/websocket";
import { logger } from "../../services/logger";

export class RoomService {
  private ws: WebSocketService;
  private gameService: GameService;

  constructor(ws: WebSocketService) {
    this.ws = ws;
    this.gameService = new GameService(ws);
  }

  private shuffle<T>(array: T[]): T[] {
    let currentIndex = array.length;
    let randomIndex;

    while (currentIndex != 0) {
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      [array[currentIndex], array[randomIndex]] = [
        array[randomIndex],
        array[currentIndex],
      ];
    }

    return array;
  }

  async createRoom(
    type: RoomType,
    playerId: string,
    inviteCode?: string
  ): Promise<void> {
    try {
      const user = await prisma.user.findUnique({ where: { id: playerId } });
      if (!user) throw new Error("User not found");
      if (user.banned) throw new Error("User is banned");

      let code: string | undefined;
      if (type === RoomType.PRIVATE) {
        code =
          inviteCode || Math.random().toString(36).slice(2, 8).toUpperCase();
      }

      const room = await prisma.room.create({
        data: {
          type,
          status: RoomStatus.OPEN,
          players: [{ id: playerId, color: null }],
          inviteCode: code,
        },
      });

      const roomData = {
        id: room.id,
        type: room.type as RoomType,
        status: room.status as RoomStatus,
        players: room.players as { id: string; color: string | null }[],
        inviteCode: room.inviteCode || undefined,
        createdAt: room.createdAt,
      };

      await redis.setJSON(`room:${room.id}`, roomData);
      await prisma.user.update({
        where: { id: playerId },
        data: { status: UserStatus.WAITING },
      });
      await redis.set(`player:${playerId}:status`, UserStatus.WAITING);

      this.ws.broadcastToClient(playerId, {
        type: "ROOM_CREATED",
        payload: roomData,
      });
      logger.info(`Room created: ${room.id} by player: ${playerId}`);
    } catch (err) {
      logger.error("Error creating room:", err);
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: { message: (err as Error).message },
      });
      throw err;
    }
  }

  async joinRoom(
    roomId: string,
    playerId: string,
    inviteCode?: string
  ): Promise<void> {
    try {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) throw new Error("Room not found");

      const user = await prisma.user.findUnique({ where: { id: playerId } });
      if (!user) throw new Error("User not found");
      if (user.banned) throw new Error("User is banned");

      if (room.type === RoomType.PRIVATE && inviteCode !== room.inviteCode) {
        throw new Error("Invalid invite code");
      }
      if (room.status !== RoomStatus.OPEN) {
        throw new Error("Room is not open");
      }
      if (room.players.some((p: any) => p.id === playerId)) {
        throw new Error("Player already in room");
      }
      if (room.players.length >= 2) {
        throw new Error("Room is full");
      }

      const players = (
        room.players as { id: string; color: string | null }[]
      ).concat({ id: playerId, color: null });

      const colors = this.shuffle(["white", "black"]);
      players[0].color = colors[0];
      players[1].color = colors[1];

      const result = await prisma.$transaction(async (tx) => {
        const updatedRoom = await tx.room.update({
          where: { id: roomId },
          data: { players, status: RoomStatus.ACTIVE },
        });

        await tx.user.updateMany({
          where: { id: { in: players.map((p) => p.id) } },
          data: { status: UserStatus.IN_GAME },
        });

        return updatedRoom;
      });

      const roomData = {
        id: result.id,
        type: result.type as RoomType,
        status: result.status as RoomStatus,
        players: result.players as { id: string; color: string | null }[],
        inviteCode: result.inviteCode || undefined,
        createdAt: result.createdAt,
      };

      await redis.setJSON(`room:${roomId}`, roomData);
      await redis.set(`player:${playerId}:status`, UserStatus.IN_GAME);
      await redis.set(`player:${players[0].id}:status`, UserStatus.IN_GAME);

      this.ws.broadcastToRoom(roomData as Room);
      logger.info(`Player ${playerId} joined room ${roomId}`);

      await this.gameService.startGame(roomId);
    } catch (err) {
      logger.error("Error joining room:", err);
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: { message: (err as Error).message },
      });
      throw err;
    }
  }

  async joinQueue(playerId: string, isGuest: boolean): Promise<void> {
    try {
      const user = await prisma.user.findUnique({ where: { id: playerId } });
      if (!user) throw new Error("User not found");
      if (user.banned) throw new Error("User is banned");

      const queue = isGuest ? "guestQueue" : "ratedQueue";
      const queueKey = `player:${playerId}:queue`;

      await redis.lpush(queue, playerId);
      await redis.set(queueKey, queue);
      await prisma.user.update({
        where: { id: playerId },
        data: { status: UserStatus.WAITING },
      });
      await redis.set(`player:${playerId}:status`, UserStatus.WAITING);

      logger.info(`Player ${playerId} joined ${queue}`);

      const timeoutId = setTimeout(async () => {
        const stillInQueue = await redis.get(queueKey);
        if (stillInQueue) {
          await redis.lrem(queue, 0, playerId);
          await redis.del(queueKey);
          await redis.del(`player:${playerId}:queueTimeoutId`);
          await prisma.user.update({
            where: { id: playerId },
            data: { status: UserStatus.ONLINE },
          });
          await redis.set(`player:${playerId}:status`, UserStatus.ONLINE);
          this.ws.broadcastToClient(playerId, {
            type: "QUEUE_TIMEOUT",
            payload: {
              message: "No match found within 60 seconds, please try again",
            },
          });
          logger.info(`Player ${playerId} timed out from queue`);
        }
      }, 60000);

      await redis.set(
        `player:${playerId}:queueTimeoutId`,
        String(timeoutId[Symbol.toPrimitive]())
      );

      if (isGuest) {
        await this.tryMatchGuests();
      } else {
        await this.tryMatchRated(playerId);
      }
    } catch (err) {
      logger.error("Error joining queue:", err);
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: { message: (err as Error).message },
      });
      throw err;
    }
  }

  async tryMatchGuests(): Promise<void> {
    try {
      const queueLength = await redis.llen("guestQueue");
      if (queueLength < 2) return;

      const players = await redis.lpop("guestQueue", 2);
      if (!players || !Array.isArray(players) || players.length < 2) return;

      const [player1, player2] = players;

      const timeoutId1 = await redis.get(`player:${player1}:queueTimeoutId`);
      const timeoutId2 = await redis.get(`player:${player2}:queueTimeoutId`);

      if (timeoutId1) clearTimeout(Number(timeoutId1));
      if (timeoutId2) clearTimeout(Number(timeoutId2));

      await redis.del(`player:${player1}:queueTimeoutId`);
      await redis.del(`player:${player2}:queueTimeoutId`);

      try {
        const room = await prisma.$transaction(async (tx) => {
          const newRoom = await tx.room.create({
            data: {
              type: RoomType.PUBLIC,
              status: RoomStatus.ACTIVE,
              players: [
                { id: player1, color: "white" },
                { id: player2, color: "black" },
              ],
            },
          });

          await tx.user.updateMany({
            where: { id: { in: [player1, player2] } },
            data: { status: UserStatus.IN_GAME },
          });

          return newRoom;
        });

        await redis.del(`player:${player1}:queue`);
        await redis.del(`player:${player2}:queue`);

        const roomData = {
          id: room.id,
          type: room.type as RoomType,
          status: room.status as RoomStatus,
          players: room.players as { id: string; color: string | null }[],
          inviteCode: room.inviteCode || undefined,
          createdAt: room.createdAt,
        };

        await redis.setJSON(`room:${room.id}`, roomData);
        await redis.set(`player:${player1}:status`, UserStatus.IN_GAME);
        await redis.set(`player:${player2}:status`, UserStatus.IN_GAME);

        this.ws.broadcastToRoom(roomData as Room);
        logger.info(
          `Guest match created: ${room.id} (${player1} vs ${player2})`
        );

        await this.gameService.startGame(room.id);
      } catch (err) {
        await redis.lpush("guestQueue", player1);
        await redis.lpush("guestQueue", player2);
        logger.error("Error creating guest match:", err);
        throw err;
      }
    } catch (err) {
      logger.error("Error in tryMatchGuests:", err);
    }
  }

  async tryMatchRated(playerId: string): Promise<void> {
    try {
      const user = await prisma.user.findUnique({ where: { id: playerId } });
      if (!user) throw new Error("User not found");

      const queue = await redis.lrange("ratedQueue", 0, -1);
      let matchedPlayer: string | null = null;

      for (const id of queue) {
        if (id === playerId) continue;
        const opponent = await prisma.user.findUnique({ where: { id } });
        if (
          opponent &&
          Math.abs((opponent.elo || 1500) - (user.elo || 1500)) <= 100
        ) {
          matchedPlayer = id;
          break;
        }
      }

      if (!matchedPlayer) return;

      const timeoutId1 = await redis.get(`player:${playerId}:queueTimeoutId`);
      const timeoutId2 = await redis.get(
        `player:${matchedPlayer}:queueTimeoutId`
      );

      if (timeoutId1) clearTimeout(Number(timeoutId1));
      if (timeoutId2) clearTimeout(Number(timeoutId2));

      await redis.del(`player:${playerId}:queueTimeoutId`);
      await redis.del(`player:${matchedPlayer}:queueTimeoutId`);

      try {
        await redis.lrem("ratedQueue", 0, playerId);
        await redis.lrem("ratedQueue", 0, matchedPlayer);

        const colors = this.shuffle(["white", "black"]);

        const room = await prisma.$transaction(async (tx) => {
          const newRoom = await tx.room.create({
            data: {
              type: RoomType.PUBLIC,
              status: RoomStatus.ACTIVE,
              players: [
                { id: playerId, color: colors[0] },
                { id: matchedPlayer, color: colors[1] },
              ],
            },
          });

          await tx.user.updateMany({
            where: { id: { in: [playerId, matchedPlayer] } },
            data: { status: UserStatus.IN_GAME },
          });

          return newRoom;
        });

        await redis.del(`player:${playerId}:queue`);
        await redis.del(`player:${matchedPlayer}:queue`);

        const roomData = {
          id: room.id,
          type: room.type as RoomType,
          status: room.status as RoomStatus,
          players: room.players as { id: string; color: string | null }[],
          inviteCode: room.inviteCode || undefined,
          createdAt: room.createdAt,
        };

        await redis.setJSON(`room:${room.id}`, roomData);
        await redis.set(`player:${playerId}:status`, UserStatus.IN_GAME);
        await redis.set(`player:${matchedPlayer}:status`, UserStatus.IN_GAME);

        this.ws.broadcastToRoom(roomData as Room);
        logger.info(
          `Rated match created: ${room.id} (${playerId} vs ${matchedPlayer})`
        );

        await this.gameService.startGame(room.id);
      } catch (err) {
        await redis.lpush("ratedQueue", playerId);
        await redis.lpush("ratedQueue", matchedPlayer);
        logger.error("Error creating rated match:", err);
        throw err;
      }
    } catch (err) {
      logger.error("Error in tryMatchRated:", err);
    }
  }

  async handleRequestRejoin(playerId: string, gameId: string): Promise<void> {
    try {
      let game: Game | null = null;

      const gameDataFromRedis = await redis.get(`game:${gameId}`);
      if (gameDataFromRedis) {
        game = JSON.parse(gameDataFromRedis) as Game;
      } else {
        const dbGame = await prisma.game.findUnique({
          where: { id: gameId },
          include: {
            players: {
              include: {
                user: {
                  select: { name: true },
                },
              },
            },
          },
        });

        if (dbGame) {
          game = {
            id: dbGame.id,
            roomId: dbGame.roomId,
            fen: dbGame.fen,
            moveHistory: dbGame.moveHistory as unknown as Move[],
            timers: dbGame.timers as { white: number; black: number },
            timeControl: dbGame.timeControl as unknown as TimeControl,
            status: dbGame.status as GameStatus,
            players: dbGame.players.map((p) => ({
              userId: p.userId,
              color: p.color,
              name: p.user.name,
            })),
            chat: dbGame.chat as unknown as ChatMessage[],
            winnerId: dbGame.winnerId || undefined,
            createdAt: dbGame.createdAt,
          };
          await redis.setJSON(`game:${gameId}`, game);
        }
      }

      if (!game) {
        throw new Error("Game not found.");
      }

      if (game.status !== GameStatus.ACTIVE) {
        throw new Error("You can only rejoin active games.");
      }

      if (!game.players.some((p) => p.userId === playerId)) {
        throw new Error("You are not a player in this game.");
      }

      const ws = this.ws.getClient(playerId);
      if (ws) {
        ws.gameId = game.id;
        ws.roomId = game.roomId;
      }

      await prisma.user.update({
        where: { id: playerId },
        data: { status: UserStatus.IN_GAME },
      });
      await redis.set(`player:${playerId}:status`, UserStatus.IN_GAME);
      await redis.set(`player:${playerId}:lastGame`, game.id);

      this.gameService.addGameToTimer(game.id);

      this.ws.broadcastToClient(playerId, {
        type: "REJOIN_GAME",
        payload: game,
      });

      logger.info(`Player ${playerId} successfully rejoined game ${game.id}`);
    } catch (err) {
      logger.error(`Error in handleRequestRejoin for player ${playerId}:`, err);
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: {
          message: (err as Error).message,
        },
      });
    }
  }

  async handleDisconnect(ws: AuthenticatedWebSocket): Promise<void> {
    try {
      if (!ws.gameId || !ws.roomId) {
        const guestQueue = await redis.lrange("guestQueue", 0, -1);
        const ratedQueue = await redis.lrange("ratedQueue", 0, -1);

        if (guestQueue.includes(ws.playerId)) {
          await redis.lrem("guestQueue", 0, ws.playerId);
          await redis.del(`player:${ws.playerId}:queue`);
        }
        if (ratedQueue.includes(ws.playerId)) {
          await redis.lrem("ratedQueue", 0, ws.playerId);
          await redis.del(`player:${ws.playerId}:queue`);
        }

        await prisma.user.update({
          where: { id: ws.playerId },
          data: { status: UserStatus.OFFLINE },
        });
        await redis.set(`player:${ws.playerId}:status`, UserStatus.OFFLINE);
        logger.info(`Player ${ws.playerId} disconnected (not in game)`);
        return;
      }

      await prisma.user.update({
        where: { id: ws.playerId },
        data: { status: UserStatus.DISCONNECTED },
      });
      await redis.set(`player:${ws.playerId}:status`, UserStatus.DISCONNECTED, {
        EX: 30,
      });
      logger.info(`Player ${ws.playerId} disconnected from game ${ws.gameId}`);

      setTimeout(async () => {
        try {
          const status = await redis.get(`player:${ws.playerId}:status`);
          if (status !== UserStatus.DISCONNECTED) return;

          const game = await prisma.game.findUnique({
            where: { id: ws.gameId },
            include: { players: true },
          });
          if (!game) return;

          const opponent = game.players.find((p) => p.userId !== ws.playerId);
          if (!opponent) return;

          await prisma.$transaction(async (tx) => {
            await tx.game.update({
              where: { id: ws.gameId },
              data: {
                status: GameStatus.ABANDONED,
                winnerId: opponent.userId,
              },
            });

            await tx.room.update({
              where: { id: ws.roomId },
              data: { status: RoomStatus.CLOSED },
            });

            await tx.user.updateMany({
              where: { id: { in: [ws.playerId, opponent.userId] } },
              data: { status: UserStatus.ONLINE },
            });
          });

          await redis.del(`game:${ws.gameId}`);
          await redis.del(`room:${ws.roomId}`);
          await redis.del(`player:${ws.playerId}:lastGame`);
          await redis.del(`player:${opponent.userId}:lastGame`);
          await redis.set(`player:${ws.playerId}:status`, UserStatus.OFFLINE);
          await redis.set(
            `player:${opponent.userId}:status`,
            UserStatus.ONLINE
          );

          const updatedGame: Game = {
            id: game.id,
            roomId: game.roomId,
            fen: game.fen,
            moveHistory: game.moveHistory as unknown as Move[],
            timers: game.timers as { white: number; black: number },
            timeControl: game.timeControl as unknown as TimeControl,
            status: GameStatus.ABANDONED,
            players: game.players.map((p) => ({
              userId: p.userId,
              color: p.color,
            })),
            chat: game.chat as unknown as ChatMessage[],
            winnerId: opponent.userId,
            createdAt: game.createdAt,
          };

          this.ws.broadcastToGame(updatedGame);
          logger.info(
            `Game ${ws.gameId} abandoned due to player ${ws.playerId} disconnect`
          );
        } catch (err) {
          logger.error("Error in disconnect timeout:", err);
        }
      }, 30000);
    } catch (err) {
      logger.error("Error in handleDisconnect:", err);
    }
  }

  async leaveQueue(playerId: string): Promise<void> {
    try {
      const guestQueue = await redis.lrange("guestQueue", 0, -1);
      const ratedQueue = await redis.lrange("ratedQueue", 0, -1);

      if (guestQueue.includes(playerId)) {
        await redis.lrem("guestQueue", 0, playerId);
      }
      if (ratedQueue.includes(playerId)) {
        await redis.lrem("ratedQueue", 0, playerId);
      }

      await redis.del(`player:${playerId}:queue`);
      await prisma.user.update({
        where: { id: playerId },
        data: { status: UserStatus.ONLINE },
      });
      await redis.set(`player:${playerId}:status`, UserStatus.ONLINE);

      this.ws.broadcastToClient(playerId, {
        type: "QUEUE_LEFT",
        payload: {},
      });
      logger.info(`Player ${playerId} left queue`);
    } catch (err) {
      logger.error("Error leaving queue:", err);
    }
  }

  async leaveRoom(playerId: string, roomId: string): Promise<void> {
    try {
      const room = await prisma.room.findUnique({
        where: {
          id: roomId,
        },
      });

      if (!room) throw new Error("Room not found");

      const players = room.players as { id: string; color: string | null }[];
      if (!players.some((p) => p.id === playerId))
        throw new Error("Player not found");

      const updatedPlayers = players.filter((p) => p.id !== playerId);

      const status =
        updatedPlayers.length === 0 ? RoomStatus.CLOSED : room.status;

      const updatedRoom = await prisma.room.update({
        where: {
          id: roomId,
        },
        data: {
          players: updatedPlayers,
          status,
        },
      });

      await prisma.user.update({
        where: { id: playerId },
        data: { status: UserStatus.ONLINE },
      });

      await redis.set(`player:${playerId}:status`, UserStatus.ONLINE);

      const roomData = {
        id: updatedRoom.id,
        type: updatedRoom.type as RoomType,
        status: updatedRoom.status as RoomStatus,
        players: updatedPlayers,
        inviteCode: updatedRoom.inviteCode ?? undefined,
        createdAt: updatedRoom.createdAt,
      };

      if (status === RoomStatus.CLOSED) {
        await redis.del(`room:${roomId}`);
      } else {
        await redis.setJSON(`room:${roomId}`, roomData);
      }

      this.ws.broadcastToRoom(roomData as Room);

      this.ws.broadcastToClient(playerId, {
        type: "LEAVE_ROOM",
        payload: {},
      });

      logger.info(`Player ${playerId} left room ${roomId}`);
    } catch (err) {
      logger.error("Error leaving room:", err);
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: { message: (err as Error).message },
      });
      throw err;
    }
  }
}
