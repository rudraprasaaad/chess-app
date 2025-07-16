import { WebSocketService } from "../../services/websocket";
import {
  Game,
  GameStatus,
  Room,
  RoomStatus,
  RoomType,
  RoomWithGame,
} from "../../lib/types";
import { Chess } from "chess.js";
import { prisma } from "../../lib/prisma";
import { redis } from "../../services/redis";

export class GameService {
  private ws: WebSocketService;

  constructor(ws: WebSocketService) {
    this.ws = ws;
  }

  async startGame(roomId: string): Promise<Game> {
    const room = await prisma.room.findUnique({
      where: {
        id: roomId,
      },
    });

    if (!room) throw new Error("Room not found");

    const typedRoom: Room = {
      id: room.id,
      type: room.type as RoomType,
      status: room.status as RoomStatus,
      players: (room.players as { id: string; color: string | null }[]) || [],
      inviteCode: room.inviteCode || undefined,
      createdAt: room.createdAt,
    };

    if (
      typedRoom.players.length !== 2 ||
      typedRoom.players.some((p) => !p.color)
    ) {
      throw new Error("Room must have two players with assigned colors");
    }

    const chess = new Chess();
    const game = await prisma.game.create({
      data: {
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

    await redis.set(`game: ${game.id}`, JSON.stringify(formattedGame));
    typedRoom?.players.forEach((p: any) =>
      redis.set(`player:${p.id}:lastGame`, game.id, 3600)
    );
    const roomWithGame: RoomWithGame = { ...typedRoom, game: formattedGame };

    this.ws.broadcastToRoom(roomWithGame);
    return formattedGame;
  }
}
