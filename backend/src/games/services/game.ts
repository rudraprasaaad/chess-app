import { Chess } from "chess.js";
import { InputJsonValue } from "@prisma/client/runtime/library";

import {
  Game,
  GameStatus,
  RoomStatus,
  RoomType,
  RoomWithGame,
} from "../../lib/types";
import { prisma } from "../../lib/prisma";

import { WebSocketService } from "../../services/websocket";
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

    const roomData = {
      id: room.id,
      type: room.type as RoomType,
      status: room.status as RoomStatus,
      players: (room.players as { id: string; color: string | null }[]) || [],
      inviteCode: room.inviteCode || undefined,
      createdAt: room.createdAt,
    };

    if (
      roomData.players.length !== 2 ||
      roomData.players.some((p) => !p.color)
    ) {
      throw new Error("Room must have two players with assigned colors");
    }

    const colors = roomData.players.map((p) => p.color);
    if (!colors.includes("white") || !colors.includes("black")) {
      throw new Error("Room must have one white and one black player");
    }

    if (colors.filter((c) => c === "white").length !== 1) {
      throw new Error("Room must have exactly one white player");
    }

    const existingGame = await prisma.game.findFirst({
      where: { roomId, status: GameStatus.ACTIVE },
    });

    if (existingGame) {
      throw new Error("Game already active for this room");
    }

    await prisma.room.update({
      where: { id: roomId },
      data: { status: RoomStatus.ACTIVE },
    });

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
          create: roomData.players.map((p: any) => ({
            userId: p.id,
            color: p.color!,
          })),
        },
      },
      include: { players: true },
    });

    const gameData: Game = {
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

    await redis.setJSON(`game:${game.id}`, gameData);

    roomData.players.forEach((p: any) => {
      redis.del(`invalidMoves:${p.id}`);
      redis.set(`player:${p.id}:lastGame`, game.id, { EX: 3600 });
    });

    const roomWithGame: RoomWithGame = { ...roomData, game: gameData };

    this.ws.broadcastToRoom(roomWithGame);
    return gameData;
  }

  async makeMove(
    gameId: string,
    playerId: string,
    move: { from: string; to: string }
  ): Promise<void> {
    const gameData = await redis.get(`game:${gameId}`);
    if (!gameData) throw new Error("Game not found");

    const gameRaw = JSON.parse(gameData) as Game;
    const moveHistory = gameRaw.moveHistory as {
      from: string;
      to: string;
      san?: string;
    }[];
    const chess = new Chess(gameRaw.fen);
    const player = gameRaw.players.find((p) => p.userId === playerId);

    if (!player || chess.turn() !== player.color[0]) {
      throw new Error("Not your turn");
    }

    const result = chess.move(move);

    if (!result) {
      const attempts = Number(await redis.get(`invalidMoves:${playerId}`)) || 0;
      if (attempts >= 3) {
        await prisma.user.update({
          where: { id: playerId },
          data: { banned: true },
        });

        this.ws.broadcastToClient(playerId, {
          type: "ERROR",
          payload: { message: "Banned for Illegal moves." },
        });
        return;
      } else {
        await redis.set(`invalidMoves:${playerId}`, String(attempts + 1), {
          EX: 3600,
        });
        throw new Error("Illegal move.");
      }
    }

    moveHistory.push({ ...move, san: result.san });

    const playerWhoMoved = chess.turn() === "w" ? "black" : "white";

    let gameStatus = GameStatus.ACTIVE;
    let winnerId: string | undefined;

    if (chess.isCheckmate()) {
      gameStatus = GameStatus.COMPLETED;
      winnerId = player.userId;
    } else if (chess.isDraw()) {
      gameStatus = GameStatus.COMPLETED;
    }

    const updatedGame = await prisma.game.update({
      where: { id: gameId },
      data: {
        fen: chess.fen(),
        moveHistory: moveHistory as InputJsonValue[],
        status: gameStatus,
        winnerId,
        timers: {
          ...gameRaw.timers,
          [playerWhoMoved]: gameRaw.timers[playerWhoMoved] - 1,
        },
      },
    });

    const formattedGame: Game = {
      id: updatedGame.id,
      roomId: updatedGame.roomId,
      fen: updatedGame.fen,
      moveHistory: updatedGame.moveHistory,
      timers: updatedGame.timers as { white: number; black: number },
      status: updatedGame.status as GameStatus,
      players: gameRaw.players,
      chat: updatedGame.chat,
      winnerId: updatedGame.winnerId || undefined,
      createdAt: updatedGame.createdAt,
    };

    await redis.setJSON(`game:${gameId}`, formattedGame);
    this.ws.broadcastToGame(formattedGame);
  }
}
