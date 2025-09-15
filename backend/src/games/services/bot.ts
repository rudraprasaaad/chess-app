import { Chess, Square } from "chess.js";
import { Game, GameStatus } from "../../lib/types";
import { logger } from "../../services/logger";
import { StockfishEngine } from "./engine";
import { GameService } from "./game";

export const BOT_PLAYER_ID = "bot-player-001";
export const BOT_NAME = "Computer";

export class BotService {
  private gameService: GameService;
  private engine: StockfishEngine;

  constructor(gameService: GameService) {
    this.gameService = gameService;
    this.engine = new StockfishEngine();
    logger.info("BotService initialized with Stockfish engine.");
  }

  public async onGameUpdate(game: Game): Promise<void> {
    if (game.status !== GameStatus.ACTIVE || !this.isBotTurn(game)) {
      return;
    }

    const thinkingTime = this.getThinkingTime();
    logger.info(`Bot is thinking for ~${thinkingTime}ms in game ${game.id}...`);

    try {
      await this.makeBotMove(game, thinkingTime);
    } catch (error) {
      logger.error(`Bot failed to make a move in game ${game.id}:`, error);
    }
  }

  private isBotTurn(game: Game): boolean {
    const botPlayer = game.players.find((p) => p.userId === BOT_PLAYER_ID);
    if (!botPlayer) return false;

    const chess = new Chess(game.fen);
    return botPlayer.color.startsWith(chess.turn());
  }

  private async makeBotMove(game: Game, moveTime: number): Promise<void> {
    const bestMoveUCI = await this.engine.findBestMove(game.fen, moveTime);

    if (!bestMoveUCI || bestMoveUCI === "(none)") {
      logger.warn(`Stockfish returned no move for game ${game.id}`);
      return;
    }

    const from = bestMoveUCI.substring(0, 2) as Square;
    const to = bestMoveUCI.substring(2, 4) as Square;
    const promotion =
      bestMoveUCI.length === 5 ? bestMoveUCI.substring(4) : undefined;

    const move = { from, to, promotion };

    logger.info(`Bot is making move ${bestMoveUCI} in game ${game.id}.`);

    await this.gameService.makeMove(game.id, BOT_PLAYER_ID, move);
  }

  private getThinkingTime(): number {
    return Math.floor(Math.random() * 2500) + 1500;
  }

  public shutdown(): void {
    logger.info("Shutting down BotService and Stockfish engine.");
    this.engine.quit();
  }
}
