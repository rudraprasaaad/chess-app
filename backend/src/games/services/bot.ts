import { Chess, Square } from "chess.js";
import { Game, GameStatus } from "../../lib/types";
import { GameService } from "./game";
import { logger } from "../../services/logger";
import { LightweightEngine } from "./engine"; // Changed import

export const BOT_PLAYER_ID = "bot-player-001";
export const BOT_NAME = "ChessMaster AI";

export class BotService {
  private gameService: GameService;
  private gameEngines: Map<string, LightweightEngine> = new Map();
  private maxConcurrentGames = 5;

  constructor(gameService: GameService) {
    this.gameService = gameService;
    logger.info("BotService initialized with lightweight engine management.");
  }

  public async onGameUpdate(game: Game): Promise<void> {
    if (game.status !== GameStatus.ACTIVE || !this.isBotTurn(game)) {
      return;
    }

    if (this.gameEngines.size >= this.maxConcurrentGames) {
      logger.warn(
        `Bot game capacity reached (${this.maxConcurrentGames}). Rejecting game ${game.id}`
      );
      return;
    }

    try {
      const thinkingTime = this.getThinkingTime();
      logger.info(
        `Bot is thinking for ~${thinkingTime}ms in game ${game.id}...`
      );

      await this.makeBotMove(game, thinkingTime);
    } catch (error) {
      logger.error(`Bot failed to make a move in game ${game.id}:`, error);
      this.cleanupGame(game.id);
    }
  }

  private isBotTurn(game: Game): boolean {
    const botPlayer = game.players.find((p) => p.userId === BOT_PLAYER_ID);
    if (!botPlayer) return false;

    const chess = new Chess(game.fen);
    return botPlayer.color.startsWith(chess.turn());
  }

  private async makeBotMove(game: Game, moveTime: number): Promise<void> {
    let engine = this.gameEngines.get(game.id);
    if (!engine) {
      const difficulty = Math.floor(Math.random() * 3) + 2;
      engine = new LightweightEngine(difficulty);
      this.gameEngines.set(game.id, engine);
      logger.info(
        `Created new lightweight engine for game ${game.id} (difficulty: ${difficulty}). Active engines: ${this.gameEngines.size}`
      );
    }

    const bestMoveUCI = await engine.findBestMove(game.fen, moveTime);

    if (!bestMoveUCI || bestMoveUCI === "") {
      logger.warn(`Engine returned no move for game ${game.id}.`);
      return;
    }

    const move = this.convertMoveFormat(bestMoveUCI);

    if (!move) {
      logger.warn(`Could not convert move format: ${bestMoveUCI}`);
      return;
    }

    logger.info(`Bot is making move ${bestMoveUCI} in game ${game.id}.`);

    await this.gameService.makeMove(game.id, BOT_PLAYER_ID, move);
  }

  private convertMoveFormat(
    engineMove: string
  ): { from: Square; to: Square; promotion?: string } | null {
    try {
      if (engineMove.length < 4) {
        return null;
      }

      const from = engineMove.substring(0, 2).toLowerCase() as Square;
      const to = engineMove.substring(2, 4).toLowerCase() as Square;
      const promotion =
        engineMove.length === 5
          ? engineMove.substring(4).toLowerCase()
          : undefined;

      return { from, to, promotion };
    } catch (error) {
      logger.error(`Error converting move format: ${engineMove}`, error);
      return null;
    }
  }

  private getThinkingTime(): number {
    return Math.floor(Math.random() * 2000) + 1000;
  }

  public cleanupGame(gameId: string): void {
    const engine = this.gameEngines.get(gameId);
    if (engine) {
      engine.quit();
      this.gameEngines.delete(gameId);
      logger.info(
        `Cleaned up lightweight engine for game ${gameId}. Active engines: ${this.gameEngines.size}`
      );
    }
  }

  public getActiveBotGames(): number {
    return this.gameEngines.size;
  }

  public canStartNewBotGame(): boolean {
    return this.gameEngines.size < this.maxConcurrentGames;
  }

  public shutdown(): void {
    logger.info("Shutting down BotService and all lightweight engines.");
    this.gameEngines.forEach((engine, gameId) => {
      engine.quit();
    });
    this.gameEngines.clear();
  }
}
