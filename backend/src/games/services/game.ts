import { Chess, Square } from "chess.js";
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
import { UserStatus } from "@prisma/client";
import { logger } from "../../services/logger";

export class GameService {
  private ws: WebSocketService;

  constructor(ws: WebSocketService) {
    this.ws = ws;
  }

  private gameTimers: Map<string, NodeJS.Timeout> = new Map();

  private clearGameTimer(gameId: string): void {
    const timer = this.gameTimers.get(gameId);
    if (timer) {
      clearInterval(timer);
      this.gameTimers.delete(gameId);
    }
    redis.del(`gameTimerActive:${gameId}`);
  }

  private async startGameTimer(gameId: string): Promise<void> {
    const timerId = setInterval(async () => {
      try {
        const gameData = await redis.get(`game:${gameId}`);
        if (!gameData) {
          this.clearGameTimer(gameId);
          return;
        }

        const game = JSON.parse(gameData) as Game;

        if (game.status !== GameStatus.ACTIVE) {
          this.clearGameTimer(gameId);
          return;
        }

        const currentTurn = game.fen.split(" ")[1] as "w" | "b";
        const colorMap = { w: "white", b: "black" } as const;
        const currentColor = colorMap[currentTurn];

        if (game.timers[currentColor] <= 0) {
          this.clearGameTimer(gameId);
          await this.handleTimeout(gameId, currentColor);
        }
      } catch (err) {
        logger.error("Error in game timer:", err);
        clearInterval(timerId);
      }
    }, 1000);

    this.gameTimers.set(gameId, timerId);

    await redis.set(`gameTimerActive:${gameId}`, "true", { EX: 7200 });
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

    await this.startGameTimer(game.id);
    return gameData;
  }

  async makeMove(
    gameId: string,
    playerId: string,
    move: { from: Square; to: Square; promotion?: string }
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

    const result = chess.move({
      from: move.from,
      to: move.to,
      promotion: move.promotion,
    });

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

        this.ws.broadcastToClient(playerId, {
          type: "ILLEGAL_MOVE",
          payload: {
            gameId,
            move,
            attempts: attempts + 1,
            maxAttempts: 3,
          },
        });
        return;
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

  async getLegalMoves(
    gameId: string,
    playerId: string,
    square: Square
  ): Promise<void> {
    try {
      const gameData = await redis.get(`game:${gameId}`);

      if (!gameData) {
        logger.warn(`getLegalMoves: Game not found in Redis: ${gameId}`);
        return;
      }

      const game = JSON.parse(gameData) as Game;
      const player = game.players.find((p) => p.userId === playerId);

      const chess = new Chess(game.fen);

      const turn = chess.turn();
      const piece = chess.get(square);

      if (
        !player ||
        !piece ||
        turn !== player.color[0] ||
        piece.color !== turn
      ) {
        this.ws.broadcastToClient(playerId, {
          type: "LEGAL_MOVES_UPDATE",
          payload: { moves: [] },
        });
        return;
      }

      const moves = chess.moves({
        square,
        verbose: true,
      });

      const destinationSquares = moves.map((move) => move.to);

      this.ws.broadcastToClient(playerId, {
        type: "LEGAL_MOVES_UPDATE",
        payload: {
          moves: destinationSquares,
        },
      });
    } catch (err) {
      logger.error(`Error in getLegalMoves for game ${gameId}`, err);
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: { message: "Could not retrieve legal moves." },
      });
    }
  }

  async resignGame(gameId: string, playerId: string): Promise<void> {
    try {
      const gameData = await redis.get(`game:${gameId}`);
      if (!gameData) throw new Error("Game not found");

      const game = JSON.parse(gameData) as Game;
      const player = game.players.find((p) => p.userId === playerId);

      if (!player) throw new Error("Player not in this game");
      if (game.status !== GameStatus.ACTIVE)
        throw new Error("Game is not active");

      const opponent = game.players.find((p) => p.userId !== playerId);
      if (!opponent) throw new Error("Opponent not found");

      await prisma.game.update({
        where: {
          id: gameId,
        },
        data: {
          status: GameStatus.COMPLETED,
          winnerId: opponent.userId,
        },
      });

      const formattedGame: Game = {
        ...game,
        status: GameStatus.COMPLETED,
        winnerId: opponent.userId,
      };

      await redis.setJSON(`game:${gameId}`, formattedGame);

      await prisma.user.updateMany({
        where: { id: { in: [playerId, opponent.userId] } },
        data: { status: UserStatus.ONLINE },
      });

      const resignedPlayer = await prisma.user.findUnique({
        where: {
          id: playerId,
        },
      });

      game.players.forEach((gamePlayer) => {
        this.ws.broadcastToClient(gamePlayer.userId, {
          type: "PLAYER_RESIGNED",
          payload: {
            game: formattedGame,
            playerName: resignedPlayer?.name || "Player Resigned",
            winnerId: opponent.userId,
          },
        });
      });

      logger.info(`Player ${playerId} resgined from game ${gameId}`);
    } catch (err) {
      logger.error("Error in resignGame:", err);
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: { message: (err as Error).message },
      });
      throw err;
    }
  }

  async offerDraw(gameId: string, playerId: string): Promise<void> {
    try {
      const gameData = await redis.get(`game:${gameId}`);
      if (!gameData) throw new Error("Game not found");

      const game = JSON.parse(gameData) as Game;
      const player = game.players.find((p) => p.userId === playerId);

      if (!player) throw new Error("Player not in this game.");

      if (game.status !== GameStatus.ACTIVE)
        throw new Error("Game is not active");

      const opponent = game.players.find((p) => p.userId !== playerId);
      if (!opponent) throw new Error("Opponent not found.");

      await redis.set(`drawOffer:${gameId}:${playerId}`, "true", { EX: 300 });

      const offerPlayer = await prisma.user.findUnique({
        where: { id: playerId },
      });

      this.ws.broadcastToClient(opponent.userId, {
        type: "DRAW_OFFERED",
        payload: {
          gameId,
          playerName: offerPlayer?.name || "Player",
          playerId,
        },
      });

      this.ws.broadcastToClient(playerId, {
        type: "DRAW_OFFER_SENT",
        payload: { gameId },
      });

      logger.info(`Player ${playerId} offered draw in game ${gameId}`);
    } catch (err) {
      logger.error("Error in offerDraw:", err);
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: { message: (err as Error).message },
      });
      throw err;
    }
  }

  async acceptDraw(gameId: string, playerId: string): Promise<void> {
    try {
      const gameData = await redis.get(`game:${gameId}}`);
      if (!gameData) throw new Error("Game not found");

      const game = JSON.parse(gameData) as Game;
      const player = game.players.find((p) => p.userId === playerId);

      if (!player) throw new Error("Player not in this game");
      if (game.status !== GameStatus.ACTIVE)
        throw new Error("Game is not active");

      const opponent = game.players.find((p) => p.userId !== playerId);
      if (!opponent) throw new Error("Opponent not found");

      const drawOffer = await redis.get(
        `drawOffer:${gameId}:${opponent.userId}`
      );
      if (!drawOffer) throw new Error("No draw offer to accept");

      await prisma.game.update({
        where: {
          id: gameId,
        },
        data: {
          status: GameStatus.DRAW,
        },
      });

      const formattedGame: Game = {
        ...game,
        status: GameStatus.DRAW,
      };

      await redis.setJSON(`game:${gameId}`, formattedGame);

      await redis.del(`drawOffer:${gameId}:${opponent.userId}`);

      await prisma.user.updateMany({
        where: { id: { in: [playerId, opponent.userId] } },
        data: { status: UserStatus.ONLINE },
      });

      game.players.forEach((gamePlayer) => {
        this.ws.broadcastToClient(gamePlayer.userId, {
          type: "DRAW_ACCEPTED",
          payload: {
            game: formattedGame,
            gameId,
          },
        });
      });

      logger.info(`Draw accepted in game ${gameId}`);
    } catch (err) {
      logger.error("Error in acceptDraw:", err);
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: { message: (err as Error).message },
      });
      throw err;
    }
  }

  async declineDraw(gameId: string, playerId: string): Promise<void> {
    try {
      const gameData = await redis.get(`game:${gameId}`);
      if (!gameData) throw new Error("Game not found");

      const game = JSON.parse(gameData) as Game;
      const opponent = game.players.find((p) => p.userId !== playerId);

      if (!opponent) throw new Error("Opponent not found");

      await redis.del(`drawOffer:${gameId}:${opponent.userId}`);

      this.ws.broadcastToClient(opponent.userId, {
        type: "DRAW_DECLINED",
        payload: { gameId },
      });

      logger.info(`Draw declined in game ${gameId}`);
    } catch (err) {
      logger.error("Error in declineDraw:", err);
      throw err;
    }
  }

  async handleTimeout(
    gameId: string,
    playerColor: "white" | "black"
  ): Promise<void> {
    try {
      const gameData = await redis.get(`game:${gameId}`);
      if (!gameData) throw new Error("Game not found");

      const game = JSON.parse(gameData) as Game;
      if (game.status !== GameStatus.ACTIVE) return;

      const timedOutPlayer = game.players.find((p) => p.color === playerColor);
      const winner = game.players.find((p) => p.color !== playerColor);

      if (!timedOutPlayer || !winner) throw new Error("Player not found");

      await prisma.game.update({
        where: {
          id: gameId,
        },
        data: {
          status: GameStatus.COMPLETED,
          winnerId: winner.userId,
        },
      });

      const formattedGame: Game = {
        ...game,
        status: GameStatus.COMPLETED,
        winnerId: winner.userId,
      };

      await redis.setJSON(`game:${gameId}`, formattedGame);

      await prisma.user.updateMany({
        where: { id: { in: [timedOutPlayer.userId, winner.userId] } },
        data: { status: UserStatus.ONLINE },
      });

      game.players.forEach((gamePlayer) => {
        this.ws.broadcastToClient(gamePlayer.userId, {
          type: "TIME_OUT",
          payload: {
            game: formattedGame,
            winnerId: winner.userId,
            timedOutPlayer: playerColor,
          },
        });
      });
      logger.info(`Time out in game ${gameId}, ${playerColor} lost`);
    } catch (err) {
      logger.error("Error in handleTimeout:", err);
      throw err;
    }
  }
}
