import { prisma } from "../../lib/prisma";
import {
  Room,
  Game,
  AuthenticatedWebSocket,
  UserStatus,
  RoomType,
  RoomStatus,
  GameStatus,
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
      const colors = ["white", "black"].sort(() => Math.random() - 0.5);
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
      await redis.set(queueKey, queue, { EX: 60 });
      await prisma.user.update({
        where: { id: playerId },
        data: { status: UserStatus.WAITING },
      });
      await redis.set(`player:${playerId}:status`, UserStatus.WAITING);

      logger.info(`Player ${playerId} joined ${queue}`);

      setTimeout(async () => {
        const stillInQueue = await redis.get(queueKey);
        if (stillInQueue) {
          await redis.lrem(queue, 0, playerId);
          await redis.del(queueKey);
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

      try {
        await redis.lrem("ratedQueue", 0, playerId);
        await redis.lrem("ratedQueue", 0, matchedPlayer);

        const room = await prisma.$transaction(async (tx) => {
          const newRoom = await tx.room.create({
            data: {
              type: RoomType.PUBLIC,
              status: RoomStatus.ACTIVE,
              players: [
                { id: playerId, color: "white" },
                { id: matchedPlayer, color: "black" },
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

  async handleReconnect(ws: AuthenticatedWebSocket): Promise<void> {
    try {
      const lastGameId = await redis.get(`player:${ws.playerId}:lastGame`);
      if (!lastGameId) return;

      const game = await prisma.game.findUnique({
        where: { id: lastGameId },
        include: { players: true },
      });
      if (!game || game.status !== GameStatus.ACTIVE) return;

      ws.gameId = game.id;
      ws.roomId = game.roomId;

      const room = await prisma.room.findUnique({ where: { id: game.roomId } });
      if (!room) return;

      const roomData = {
        id: room.id,
        type: room.type as RoomType,
        status: room.status as RoomStatus,
        players: room.players as { id: string; color: string | null }[],
        inviteCode: room.inviteCode || undefined,
        createdAt: room.createdAt,
      };

      const gameData: Game = {
        id: game.id,
        roomId: game.roomId,
        fen: game.fen,
        moveHistory: game.moveHistory,
        timers: game.timers as { white: number; black: number },
        status: game.status as GameStatus,
        players: game.players.map((p) => ({
          userId: p.userId,
          color: p.color,
        })),
        chat: game.chat,
        winnerId: game.winnerId || undefined,
        createdAt: game.createdAt,
      };

      await redis.setJSON(`game:${game.id}`, gameData);
      await prisma.user.update({
        where: { id: ws.playerId },
        data: { status: UserStatus.IN_GAME },
      });
      await redis.set(`player:${ws.playerId}:status`, UserStatus.IN_GAME);

      this.ws.broadcastToClient(ws.playerId, {
        type: "REJOIN_GAME",
        payload: gameData,
      });
      logger.info(`Player ${ws.playerId} reconnected to game ${game.id}`);
    } catch (err) {
      logger.error("Error in handleReconnect:", err);
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
            moveHistory: game.moveHistory,
            timers: game.timers as { white: number; black: number },
            status: GameStatus.ABANDONED,
            players: game.players.map((p) => ({
              userId: p.userId,
              color: p.color,
            })),
            chat: game.chat,
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
}
