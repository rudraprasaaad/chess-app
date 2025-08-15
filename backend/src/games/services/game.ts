/* eslint-disable @typescript-eslint/no-explicit-any */
import { Chess, Square } from "chess.js";
import { InputJsonValue } from "@prisma/client/runtime/library";

import {
  ChatMessage,
  Game,
  GameStatus,
  Move,
  RoomStatus,
  RoomType,
  RoomWithGame,
  TimeControl,
} from "../../lib/types";
import { prisma } from "../../lib/prisma";

import { WebSocketService } from "../../services/websocket";
import { redis } from "../../services/redis";
import { UserStatus } from "@prisma/client";
import { logger } from "../../services/logger";

export class GameService {
  private ws: WebSocketService;

  private activeGames: Set<string> = new Set();
  private masterTimer: NodeJS.Timeout | null = null;

  constructor(ws: WebSocketService) {
    this.ws = ws;
    this.startMasterTimer();
  }

  private startMasterTimer(): void {
    if (this.masterTimer) return;

    this.masterTimer = setInterval(async () => {
      if (this.activeGames.size === 0) return;

      for (const gameId of this.activeGames) {
        try {
          const gameData = await redis.get(`game:${gameId}`);
          if (!gameData) {
            this.activeGames.delete(gameId);
            continue;
          }

          const game = JSON.parse(gameData) as Game;

          if (game.status !== GameStatus.ACTIVE) {
            this.activeGames.delete(gameId);
            continue;
          }

          const currentTurn = game.fen.split(" ")[1] as "w" | "b";
          const colorMap = { w: "white", b: "black" } as const;
          const currentColor = colorMap[currentTurn];

          game.timers[currentColor] -= 1;

          await redis.setJSON(`game:${gameId}`, game);

          this.ws.broadcastToGame(game, "TIMER_UPDATE", {
            white: game.timers.white,
            black: game.timers.black,
            game: gameId,
          });

          if (game.timers[currentColor] <= 0)
            await this.handleTimeout(gameId, currentColor);
        } catch (err) {
          logger.error(`Error in master timer loop for game ${gameId}:`, err);
          this.activeGames.delete(gameId);
        }
      }
    }, 1000);

    logger.info("Master game timer has started");
  }

  public addGameToTimer(gameId: string) {
    this.activeGames.add(gameId);
    logger.info(`Game ${gameId} added to master timer.`);
  }

  public removeGameFromTimer(gameId: string) {
    this.activeGames.delete(gameId);
    logger.info(`Game ${gameId} removed from master timer.`);
  }

  async loadGame(gameId: string, playerId: string): Promise<void> {
    try {
      if (!gameId || typeof gameId !== "string" || gameId.trim().length === 0) {
        this.ws.broadcastToClient(playerId, {
          type: "INVALID_GAME_ID",
          payload: { message: "Invalid game ID format" },
        });
        return;
      }

      const gameData = await redis.get(`game:${gameId}`);
      let game: Game;

      if (gameData) {
        game = JSON.parse(gameData) as Game;
      } else {
        const dbGame = await prisma.game.findUnique({
          where: { id: gameId },
          include: {
            players: {
              include: {
                user: true,
              },
            },
          },
        });

        if (!dbGame) {
          this.ws.broadcastToClient(playerId, {
            type: "GAME_NOT_FOUND",
            payload: { message: "Game not found" },
          });
          return;
        }

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

      const isPlayerInGame = game.players.some((p) => p.userId === playerId);

      if (!isPlayerInGame) {
        this.ws.broadcastToClient(playerId, {
          type: "UNAUTHORIZED",
          payload: { message: "Not authorized to view this game" },
        });
        return;
      }

      this.ws.broadcastToClient(playerId, {
        type: "GAME_LOADED",
        payload: game,
      });

      if (game.status === GameStatus.ACTIVE) this.addGameToTimer(game.id);

      logger.info(`Game ${gameId} loaded for player ${playerId}`);
    } catch (error) {
      logger.error(
        `Error loading game ${gameId} for player ${playerId}:`,
        error
      );
      this.ws.broadcastToClient(playerId, {
        type: "LOAD_GAME_ERROR",
        payload: { message: "Failed to load game" },
      });
    }
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

    const timeControl: TimeControl = {
      initial: 600,
      increment: 0,
    };
    const game = await prisma.game.create({
      data: {
        roomId,
        fen: chess.fen(),
        moveHistory: [],
        timers: { white: timeControl.initial, black: timeControl.initial },
        timeControl: timeControl as unknown as InputJsonValue,
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

    const playerIds = roomData.players.map((p) => p.id);
    const users = await prisma.user.findMany({
      where: { id: { in: playerIds } },
      select: { id: true, name: true },
    });

    const userNameMap = new Map(users.map((u) => [u.id, u.name]));

    const gameData: Game = {
      id: game.id,
      roomId: game.roomId,
      fen: game.fen,
      moveHistory: game.moveHistory as unknown as Move[],
      timers: game.timers as { white: number; black: number },
      timeControl: game.timeControl as unknown as TimeControl,
      status: game.status as GameStatus,
      players: game.players.map((p) => ({
        userId: p.userId,
        color: p.color,
        name: userNameMap.get(p.userId) || "Player",
      })),
      chat: game.chat as unknown as ChatMessage[],
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

    this.addGameToTimer(game.id);
    return gameData;
  }

  async makeMove(
    gameId: string,
    playerId: string,
    move: { from: Square; to: Square; promotion?: string }
  ): Promise<void> {
    const gameData = await redis.get(`game:${gameId}`);
    if (!gameData) throw new Error("Game not found");
    const game = JSON.parse(gameData) as Game;
    const chess = new Chess(game.fen);
    const player = game.players.find((p) => p.userId === playerId);

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
          payload: { gameId, move, attempts: attempts + 1, maxAttempts: 3 },
        });
        return;
      }
    }

    const movedPlayerColor = player.color as "white" | "black";
    game.timers[movedPlayerColor] += game.timeControl.increment;

    game.fen = chess.fen();
    game.moveHistory.push({
      from: move.from,
      to: move.to,
      promotion: move.promotion as "q" | "r" | "b" | "n",
      san: result.san,
    });

    if (chess.isCheckmate()) {
      this.removeGameFromTimer(gameId);
      game.status = GameStatus.COMPLETED;
      game.winnerId = player.userId;
    } else if (chess.isDraw()) {
      this.removeGameFromTimer(gameId);
      game.status = GameStatus.DRAW;
    }

    if (game.status !== GameStatus.ACTIVE) {
      await prisma.$transaction(async (tx) => {
        await tx.game.update({
          where: {
            id: gameId,
          },
          data: {
            fen: game.fen,
            moveHistory: game.moveHistory as unknown as InputJsonValue[],
            status: game.status,
            winnerId: game.winnerId,
            chat: game.chat as unknown as InputJsonValue[],
            timers: game.timers as unknown as InputJsonValue,
            timeControl: game.timeControl as unknown as InputJsonValue,
          },
        });

        await tx.room.update({
          where: { id: game.roomId },
          data: { status: RoomStatus.CLOSED },
        });
      }),
        {
          maxWait: 10000,
          timeout: 20000,
        };
    }

    await redis.setJSON(`game:${gameId}`, game);

    this.ws.broadcastToGame(game);
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
    this.removeGameFromTimer(gameId);
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

      await prisma.$transaction(
        async (tx) => {
          await tx.game.update({
            where: {
              id: gameId,
            },
            data: {
              status: GameStatus.RESIGNED,
              winnerId: opponent.userId,
              fen: game.fen,
              timers: game.timers as InputJsonValue,
              moveHistory: game.moveHistory as unknown as InputJsonValue[],
              chat: game.chat as unknown as InputJsonValue[],
              timeControl: game.timeControl as unknown as InputJsonValue,
            },
          });

          await tx.room.update({
            where: { id: game.roomId },
            data: { status: RoomStatus.CLOSED },
          });

          await tx.user.updateMany({
            where: { id: { in: [playerId, opponent.userId] } },
            data: { status: UserStatus.ONLINE },
          });
        },
        {
          maxWait: 10000,
          timeout: 20000,
        }
      );

      const formattedGame: Game = {
        ...game,
        status: GameStatus.RESIGNED,
        winnerId: opponent.userId,
      };

      await redis.setJSON(`game:${gameId}`, formattedGame);

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
    this.removeGameFromTimer(gameId);
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

      const drawOffer = await redis.get(
        `drawOffer:${gameId}:${opponent.userId}`
      );
      if (!drawOffer) throw new Error("No draw offer to accept");

      await prisma.$transaction(
        async (tx) => {
          await tx.game.update({
            where: {
              id: gameId,
            },
            data: {
              status: GameStatus.DRAW,
              fen: game.fen,
              timers: game.timers as InputJsonValue,
              moveHistory: game.moveHistory as unknown as InputJsonValue[],
              chat: game.chat as unknown as InputJsonValue[],
              timeControl: game.timeControl as unknown as InputJsonValue,
            },
          });

          await tx.room.update({
            where: {
              id: game.roomId,
            },
            data: {
              status: RoomStatus.CLOSED,
            },
          });

          await tx.user.updateMany({
            where: { id: { in: [playerId, opponent.userId] } },
            data: { status: UserStatus.ONLINE },
          });
        },
        {
          maxWait: 10000,
          timeout: 20000,
        }
      );

      const formattedGame: Game = {
        ...game,
        status: GameStatus.DRAW,
      };

      await redis.setJSON(`game:${gameId}`, formattedGame);

      await redis.del(`drawOffer:${gameId}:${opponent.userId}`);

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
    this.removeGameFromTimer(gameId);
    try {
      const gameData = await redis.get(`game:${gameId}`);
      if (!gameData) throw new Error("Game not found");

      const game = JSON.parse(gameData) as Game;
      if (game.status !== GameStatus.ACTIVE) return;

      const timedOutPlayer = game.players.find((p) => p.color === playerColor);
      const winner = game.players.find((p) => p.color !== playerColor);

      if (!timedOutPlayer || !winner) throw new Error("Player not found");

      await prisma.$transaction(
        async (tx) => {
          await tx.game.update({
            where: {
              id: gameId,
            },
            data: {
              status: GameStatus.COMPLETED,
              winnerId: winner.userId,
              fen: game.fen,
              timers: game.timers as InputJsonValue,
              moveHistory: game.moveHistory as unknown as InputJsonValue[],
              chat: game.chat as unknown as InputJsonValue[],
              timeControl: game.timeControl as unknown as InputJsonValue,
            },
          });

          await tx.room.update({
            where: {
              id: game.roomId,
            },
            data: {
              status: RoomStatus.CLOSED,
            },
          });

          await tx.user.updateMany({
            where: {
              id: { in: [timedOutPlayer.userId, winner.userId] },
            },
            data: { status: UserStatus.ONLINE },
          });
        },
        {
          maxWait: 10000,
          timeout: 20000,
        }
      );

      const formattedGame: Game = {
        ...game,
        status: GameStatus.COMPLETED,
        winnerId: winner.userId,
      };

      await redis.setJSON(`game:${gameId}`, formattedGame);

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
