import { createClient, RedisClientType } from "redis";
import { PrismaClient } from "../../generated/prisma";
import { WebSocketService } from "../../services/websocket";
import {
  Game,
  GameStatus,
  Room,
  RoomStatus,
  RoomType,
  RoomWithGame,
} from "../../lib/types";
import { LoggerService } from "../../services/logger";
import { Chess } from "chess.js";
import { v4 as uuidv4 } from "uuid";

export class GameService {
  private prisma: PrismaClient;
  private redis: RedisClientType;
  private ws: WebSocketService;
  private logger: LoggerService;

  constructor(ws: WebSocketService) {
    this.prisma = new PrismaClient();
    this.redis = createClient().connect() as any;
    this.ws = ws;
    this.logger = new LoggerService();
  }

  async startGame(roomId: string): Promise<Game> {
    const room = await this.prisma.room.findUnique({
      where: {
        id: roomId,
      },
    });

    if (!room) this.logger.error("Room not found!!");

    const typedRoom: Room = {
      id: room?.id!,
      type: room?.type as RoomType,
      status: room?.status as RoomStatus,
      players: (room?.players as { id: string; color: string | null }[]) || [],
      inviteCode: room?.inviteCode ?? "",
      createdAt: room?.createdAt ?? new Date(),
    };

    const chess = new Chess();
    const game = await this.prisma.game.create({
      data: {
        id: uuidv4(),
        roomId,
        fen: chess.fen(),
        moveHistory: [],
        timers: { white: 600, black: 600 },
        status: GameStatus.ACTIVE,
        chat: [],
        players: {
          create: room?.players.map((p: any) => ({
            userId: p.id,
            color: p.color!,
          })),
        },
      },
      include: { players: true },
    });

    const formattedGame: Game = {
      id: game.id,
      roomId: game.roomId,
      fen: game.fen,
      moveHistory: game.moveHistory,
      timers: game.timers as { white: number; black: number },
      status: game.status as GameStatus,
      players: game.players.map((p) => ({ userId: p.userId, color: p.color })),
      chat: game.chat,
      winnerId: game.winnerId || undefined,
      createdAt: game.createdAt,
    };

    await this.redis.set(`game: ${game.id}`, JSON.stringify(formattedGame));
    typedRoom?.players.forEach((p: any) =>
      this.redis.set(`player:${p.id}:lastGame`, game.id, { EX: 3600 })
    );
    const roomWithGame: RoomWithGame = { ...typedRoom, game: formattedGame };

    this.ws.broadCastToRoom(roomWithGame);
    return formattedGame;
  }
}
