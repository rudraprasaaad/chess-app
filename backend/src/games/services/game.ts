/* eslint-disable @typescript-eslint/no-explicit-any */
import { Chess, Square } from "chess.js";
import { InputJsonValue } from "@prisma/client/runtime/library";

import {
  AuthProvider,
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
import { findBestMove } from "./bot/chess-bot";

type GameWithoutTimers = Omit<Game, "timers">;

export class GameService {
  private ws: WebSocketService;
  private activeGames: Set<string> = new Set();
  private masterTimer: NodeJS.Timeout | null = null;

  constructor(ws: WebSocketService) {
    this.ws = ws;
    this.startMasterTimer();
  }

  private async atomicUpdate(
    keysToWatch: string[],
    updateCallback: (
      data: Record<string, any>
    ) => Record<string, any> | Promise<Record<string, any>>,
    maxRetries = 3
  ): Promise<Record<string, any>> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        for (const key of keysToWatch) {
          await redis.watch(key);
        }
        const data: Record<string, any> = {};
        for (const key of keysToWatch) {
          const value = await redis.get(key);
          data[key] = value ? JSON.parse(value) : null;
        }

        const updatedData = await updateCallback(data);

        const multi = await redis.multi();
        for (const [key, value] of Object.entries(updatedData)) {
          multi.set(key, JSON.stringify(value));
        }
        const result = await redis.exec(multi);
        await redis.unwatch();

        if (result === null) {
          logger.warn(
            `Transaction conflict on keys ${keysToWatch.join(
              ", "
            )}, retrying [Attempt ${attempt + 1}]`
          );
          continue;
        }

        return updatedData;
      } catch (error) {
        await redis.unwatch();
        logger.error(
          `Transaction error on keys ${keysToWatch.join(", ")}:`,
          error
        );
        if (attempt === maxRetries - 1) throw error;
      }
    }
    throw new Error(
      `Failed after ${maxRetries} retries due to conflicts on keys ${keysToWatch.join(
        ", "
      )}`
    );
  }

  private startMasterTimer(): void {
    if (this.masterTimer) return;

    this.masterTimer = setInterval(async () => {
      if (this.activeGames.size === 0) return;

      for (const gameId of this.activeGames) {
        try {
          const timerKey = `timers:${gameId}`;
          const gameKey = `game:${gameId}`;

          const updated = await this.atomicUpdate(
            [timerKey, gameKey],
            async (data) => {
              const game = data[gameKey] as GameWithoutTimers | null;
              const timers = data[timerKey] as {
                white: number;
                black: number;
              } | null;

              if (!game || game.status !== GameStatus.ACTIVE || !timers) {
                this.activeGames.delete(gameId);
                return {};
              }

              const currentTurn = game.fen.split(" ")[1] as "w" | "b";
              const colorMap = { w: "white", b: "black" } as const;
              const currentColor = colorMap[currentTurn];

              const newTimers = { ...timers };
              newTimers[currentColor] = Math.max(
                0,
                newTimers[currentColor] - 1
              );

              return { [timerKey]: newTimers, [gameKey]: game };
            }
          );

          if (!updated[timerKey]) continue;

          const gameData = await redis.get(gameKey);
          if (!gameData) continue;
          const game = JSON.parse(gameData) as GameWithoutTimers;

          const newTimers = updated[timerKey] as {
            white: number;
            black: number;
          };

          this.ws.broadcastToGame(
            { ...game, timers: newTimers },
            "TIMER_UPDATE",
            {
              white: newTimers.white,
              black: newTimers.black,
              game: gameId,
            }
          );

          const currentTurn = game.fen.split(" ")[1] as "w" | "b";
          const colorMap = { w: "white", b: "black" } as const;
          const currentColor = colorMap[currentTurn];

          if (newTimers[currentColor] <= 0) {
            await this.handleTimeout(gameId, currentColor);
          }
        } catch (err) {
          logger.error(`Error in master timer loop for game ${gameId}:`, err);
          this.activeGames.delete(gameId);
        }
      }
    }, 1000);

    logger.info("Master game timer has started");
  }

  private async _persistGameEnd(
    game: GameWithoutTimers,
    timers: { white: number; black: number }
  ): Promise<void> {
    this.removeGameFromTimer(game.id);

    try {
      await prisma.$transaction(
        async (tx) => {
          await tx.game.update({
            where: { id: game.id },
            data: {
              status: game.status,
              winnerId: game.winnerId,
              fen: game.fen,
              moveHistory: game.moveHistory as unknown as InputJsonValue[],
              timers: timers as unknown as InputJsonValue,
            },
          });

          await tx.room.update({
            where: { id: game.roomId },
            data: { status: RoomStatus.CLOSED },
          });

          await tx.user.updateMany({
            where: { id: { in: game.players.map((p) => p.userId) } },
            data: { status: UserStatus.ONLINE },
          });
        },
        {
          maxWait: 10000,
          timeout: 20000,
        }
      );

      logger.info(
        `Game ${game.id} ended and has been persisted to the database.`
      );
    } catch (error) {
      logger.error(`Failed to persist game end for ${game.id}:`, error);
    }
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

      const gameKey = `game:${gameId}`;
      const timerKey = `timers:${gameId}`;

      const gameDataStr = await redis.get(gameKey);
      const timersDataStr = await redis.get(timerKey);
      let game: Game;

      if (gameDataStr && timersDataStr) {
        const gameData = JSON.parse(gameDataStr) as GameWithoutTimers;
        const timersData = JSON.parse(timersDataStr) as {
          white: number;
          black: number;
        };
        game = { ...gameData, timers: timersData };
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
            name: p.user.name!,
          })),
          chat: dbGame.chat as unknown as ChatMessage[],
          winnerId: dbGame.winnerId || undefined,
          createdAt: dbGame.createdAt,
        };

        await redis.set(
          gameKey,
          JSON.stringify({ ...game, timers: undefined })
        );
        await redis.set(timerKey, JSON.stringify(game.timers));
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

    const gameData: GameWithoutTimers = {
      id: game.id,
      roomId: game.roomId,
      fen: game.fen,
      moveHistory: game.moveHistory as unknown as Move[],
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

    const timersData = {
      white: timeControl.initial,
      black: timeControl.initial,
    };

    await redis.set(`game:${game.id}`, JSON.stringify(gameData));
    await redis.set(`timers:${game.id}`, JSON.stringify(timersData));

    roomData.players.forEach((p: any) => {
      redis.del(`invalidMoves:${p.id}`);
      redis.set(`player:${p.id}:lastGame`, game.id, { EX: 3600 });
    });

    const roomWithGame: RoomWithGame = {
      ...roomData,
      game: { ...gameData, timers: timersData },
    };

    this.ws.broadcastToRoom(roomWithGame);

    this.addGameToTimer(game.id);
    return { ...gameData, timers: timersData };
  }

  async startBotGame(playerId: string): Promise<Game> {
    const humanPlayer = await prisma.user.findUnique({
      where: {
        id: playerId,
      },
    });

    if (!humanPlayer) throw new Error("Player not found");

    let botUser = await prisma.user.findUnique({
      where: {
        username: "ChessBot",
      },
    });
    if (!botUser) {
      botUser = await prisma.user.create({
        data: {
          username: "ChessBot",
          name: "Computer",
          email: `bot@${Date.now()}.chess`,
          provider: AuthProvider.GUEST,
          elo: 1400,
        },
      });
    }

    const room = await prisma.room.create({
      data: {
        type: RoomType.PRIVATE,
        status: RoomStatus.ACTIVE,
        players: [
          { id: humanPlayer.id, color: "white" },
          { id: botUser.id, color: "black" },
        ],
      },
    });

    const chess = new Chess();
    const timeControl: TimeControl = { initial: 600, increment: 0 };

    const game = await prisma.game.create({
      data: {
        roomId: room.id,
        fen: chess.fen(),
        status: GameStatus.ACTIVE,
        timers: { white: timeControl.initial, black: timeControl.initial },
        timeControl: timeControl as unknown as InputJsonValue,
        players: {
          create: [
            { userId: humanPlayer.id, color: "white" },
            { userId: botUser.id, color: "black" },
          ],
        },
      },
    });

    const gameData: GameWithoutTimers = {
      id: game.id,
      roomId: game.roomId,
      fen: game.fen,
      moveHistory: [],
      timeControl: game.timeControl as unknown as TimeControl,
      status: game.status as GameStatus,
      players: [
        {
          userId: humanPlayer.id,
          color: "white",
          name: humanPlayer.name || "Player",
        },
        { userId: botUser.id, color: "black", name: "Computer" },
      ],
      chat: [],
      winnerId: undefined,
      createdAt: game.createdAt,
    };

    const timersData = {
      white: timeControl.initial,
      black: timeControl.initial,
    };

    await redis.set(`game:${game.id}`, JSON.stringify(gameData));
    await redis.set(`timers:${game.id}`, JSON.stringify(timersData));
    this.addGameToTimer(game.id);

    return { ...gameData, timers: timersData };
  }

  async makeMove(
    gameId: string,
    playerId: string,
    move: { from: Square; to: Square; promotion?: string }
  ): Promise<void> {
    const gameKey = `game:${gameId}`;
    const timerKey = `timers:${gameId}`;

    const updated = await this.atomicUpdate(
      [gameKey, timerKey],
      async (data) => {
        const game = data[gameKey] as GameWithoutTimers | null;
        const timers = data[timerKey] as {
          white: number;
          black: number;
        } | null;

        if (!game) throw new Error("Game not found");
        if (!timers) throw new Error("Timers not found");

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
          const attempts =
            Number(await redis.get(`invalidMoves:${playerId}`)) || 0;
          if (attempts >= 3) {
            await prisma.user.update({
              where: { id: playerId },
              data: { banned: true },
            });
            this.ws.broadcastToClient(playerId, {
              type: "ERROR",
              payload: { message: "Banned for Illegal moves." },
            });
            return { [gameKey]: game, [timerKey]: timers };
          } else {
            await redis.set(`invalidMoves:${playerId}`, String(attempts + 1), {
              EX: 3600,
            });
            this.ws.broadcastToClient(playerId, {
              type: "ILLEGAL_MOVE",
              payload: { gameId, move, attempts: attempts + 1, maxAttempts: 3 },
            });
            return { [gameKey]: game, [timerKey]: timers };
          }
        }

        const updatedFen = chess.fen();
        const newTurn = updatedFen.split(" ")[1] as "w" | "b";
        const colorMap = { w: "white", b: "black" } as const;
        const nextPlayerColor = colorMap[newTurn];

        if (game.timeControl.increment > 0)
          timers[nextPlayerColor] += game.timeControl.increment;

        game.fen = updatedFen;
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
          await this._persistGameEnd(game, timers);
        }

        return { [gameKey]: game, [timerKey]: timers };
      }
    );

    const game = updated[gameKey] as GameWithoutTimers;
    const timers = updated[timerKey] as { white: number; black: number };

    this.ws.broadcastToGame({ ...game, timers });

    const botPlayer = game.players.find((p) => p.name === "Computer");
    if (
      botPlayer &&
      game.status === GameStatus.ACTIVE &&
      new Chess(game.fen).turn() === botPlayer.color[0]
    ) {
      const thinkingTime = Math.floor(Math.random() * 8000) + 2000;
      setTimeout(() => {
        this.makeBotMove(gameId);
      }, thinkingTime);
    }
  }

  async makeBotMove(gameId: string): Promise<void> {
    const gameKey = `game:${gameId}`;
    const timerKey = `timers:${gameId}`;

    const updated = await this.atomicUpdate(
      [gameKey, timerKey],
      async (data) => {
        const game = data[gameKey] as GameWithoutTimers | null;
        const timers = data[timerKey] as {
          white: number;
          black: number;
        } | null;

        if (!game || game.status !== GameStatus.ACTIVE || !timers)
          return { [gameKey]: game, [timerKey]: timers };

        const chess = new Chess(game.fen);
        const botPlayer = game.players.find((p) => p.name === "Computer");

        if (!botPlayer || chess.turn() !== botPlayer.color[0]) {
          return { [gameKey]: game, [timerKey]: timers };
        }

        const botMove = findBestMove(chess, 1);

        if (botMove) {
          const botMoveResult = chess.move(botMove.san);

          if (botMoveResult) {
            game.fen = chess.fen();
            game.moveHistory.push({
              from: botMove.from,
              to: botMove.to,
              san: botMove.san,
            });

            if (game.timeControl.increment > 0) {
              const botColor = botPlayer.color as "white" | "black";
              timers[botColor] += game.timeControl.increment;
            }

            if (chess.isCheckmate() || chess.isDraw()) {
              game.status = chess.isDraw()
                ? GameStatus.DRAW
                : GameStatus.COMPLETED;
              if (chess.isCheckmate()) game.winnerId = botPlayer.userId;
              await this._persistGameEnd(game, timers);
            }
          }
        }

        return { [gameKey]: game, [timerKey]: timers };
      }
    );

    const game = updated[gameKey] as GameWithoutTimers;
    const timers = updated[timerKey] as { white: number; black: number };
    this.ws.broadcastToGame({ ...game, timers });
  }

  async getLegalMoves(
    gameId: string,
    playerId: string,
    square: Square
  ): Promise<void> {
    try {
      const gameKey = `game:${gameId}`;
      const gameDataStr = await redis.get(gameKey);

      if (!gameDataStr) {
        logger.warn(`getLegalMoves: Game not found in Redis: ${gameId}`);
        return;
      }

      const game = JSON.parse(gameDataStr) as GameWithoutTimers;
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
    const gameKey = `game:${gameId}`;
    const timerKey = `timers:${gameId}`;

    const updated = await this.atomicUpdate(
      [gameKey, timerKey],
      async (data) => {
        const game = data[gameKey] as GameWithoutTimers | null;
        const timers = data[timerKey] as {
          white: number;
          black: number;
        } | null;

        if (!game) throw new Error("Game not found");
        if (!timers) throw new Error("Timers not found");

        const player = game.players.find((p) => p.userId === playerId);

        if (!player) throw new Error("Player not in this game");
        if (game.status !== GameStatus.ACTIVE)
          throw new Error("Game is not active");

        const opponent = game.players.find((p) => p.userId !== playerId);
        if (!opponent) throw new Error("Opponent not found");

        game.status = GameStatus.RESIGNED;
        game.winnerId = opponent.userId;

        await this._persistGameEnd(game, timers);

        return { [gameKey]: game, [timerKey]: timers };
      }
    );

    const game = updated[gameKey] as GameWithoutTimers;
    const timers = updated[timerKey] as { white: number; black: number };
    const formattedGame = { ...game, timers, status: GameStatus.RESIGNED };

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
          winnerId: game.winnerId,
        },
      });
    });

    logger.info(`Player ${playerId} resigned from game ${gameId}`);
  }

  async offerDraw(gameId: string, playerId: string): Promise<void> {
    try {
      const gameData = await redis.get(`game:${gameId}`);
      if (!gameData) throw new Error("Game not found");

      const game = JSON.parse(gameData) as GameWithoutTimers;
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
    const gameKey = `game:${gameId}`;
    const timerKey = `timers:${gameId}`;

    const updated = await this.atomicUpdate(
      [gameKey, timerKey],
      async (data) => {
        const game = data[gameKey] as GameWithoutTimers | null;
        const timers = data[timerKey] as {
          white: number;
          black: number;
        } | null;

        if (!game) throw new Error("Game not found");
        if (!timers) throw new Error("Timers not found");

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

        game.status = GameStatus.DRAW;

        await this._persistGameEnd(game, timers);

        await redis.del(`drawOffer:${gameId}:${opponent.userId}`);

        return { [gameKey]: game, [timerKey]: timers };
      }
    );

    const game = updated[gameKey] as GameWithoutTimers;
    const timers = updated[timerKey] as { white: number; black: number };
    const formattedGame = { ...game, timers, status: GameStatus.DRAW };

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
  }

  async declineDraw(gameId: string, playerId: string): Promise<void> {
    try {
      const gameData = await redis.get(`game:${gameId}`);
      if (!gameData) throw new Error("Game not found");

      const game = JSON.parse(gameData) as GameWithoutTimers;
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
    const gameKey = `game:${gameId}`;
    const timerKey = `timers:${gameId}`;

    const updated = await this.atomicUpdate(
      [gameKey, timerKey],
      async (data) => {
        const game = data[gameKey] as GameWithoutTimers | null;
        const timers = data[timerKey] as {
          white: number;
          black: number;
        } | null;

        if (!game || game.status !== GameStatus.ACTIVE || !timers)
          return { [gameKey]: game, [timerKey]: timers };

        const timedOutPlayer = game.players.find(
          (p) => p.color === playerColor
        );
        const winner = game.players.find((p) => p.color !== playerColor);

        if (!timedOutPlayer || !winner) throw new Error("Player not found");

        game.status = GameStatus.COMPLETED;
        game.winnerId = winner.userId;

        await this._persistGameEnd(game, timers);

        return { [gameKey]: game, [timerKey]: timers };
      }
    );

    const game = updated[gameKey] as GameWithoutTimers;
    const timers = updated[timerKey] as { white: number; black: number };
    const formattedGame = { ...game, timers, status: GameStatus.COMPLETED };

    game.players.forEach((gamePlayer) => {
      this.ws.broadcastToClient(gamePlayer.userId, {
        type: "TIME_OUT",
        payload: {
          game: formattedGame,
          winnerId: game.winnerId,
          timedOutPlayer: playerColor,
        },
      });
    });
    logger.info(`Time out in game ${gameId}, ${playerColor} lost`);
  }
}
