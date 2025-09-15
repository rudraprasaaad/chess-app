import { Chess, Square, Move } from "chess.js";
import { logger } from "../../services/logger";

export class LightweightEngine {
  private difficulty: number;

  constructor(difficulty: number = 2) {
    this.difficulty = Math.max(1, Math.min(4, difficulty));
    logger.info(
      `Lightweight chess engine initialized with difficulty ${this.difficulty}`
    );
  }

  public async findBestMove(fen: string, moveTime: number): Promise<string> {
    return new Promise((resolve) => {
      try {
        const chess = new Chess(fen);
        const moves = chess.moves({ verbose: true });

        if (moves.length === 0) {
          resolve("");
          return;
        }

        const thinkingTime = Math.min(
          moveTime,
          this.getRealisticThinkingTime(moves.length)
        );

        setTimeout(() => {
          let selectedMove: Move;

          switch (this.difficulty) {
            case 1:
              selectedMove = this.getBeginnerMove(moves);
              break;
            case 2:
              selectedMove = this.getEasyMove(chess, moves);
              break;
            case 3:
              selectedMove = this.getMediumMove(chess, moves);
              break;
            case 4:
            default:
              selectedMove = this.getHardMove(chess, moves);
              break;
          }

          const uciMove =
            selectedMove.from +
            selectedMove.to +
            (selectedMove.promotion || "");
          resolve(uciMove);
        }, thinkingTime);
      } catch (error) {
        logger.error("Lightweight engine error:", error);
        resolve("");
      }
    });
  }

  private getBeginnerMove(moves: Move[]): Move {
    return moves[Math.floor(Math.random() * moves.length)];
  }

  private getEasyMove(chess: Chess, moves: Move[]): Move {
    if (Math.random() < 0.5) {
      return this.getBeginnerMove(moves);
    }

    const captures = moves.filter((move) => move.captured);
    if (captures.length > 0) {
      return captures[Math.floor(Math.random() * captures.length)];
    }

    const checks = moves.filter((move) => {
      chess.move(move);
      const inCheck = chess.inCheck();
      chess.undo();
      return inCheck;
    });

    if (checks.length > 0) {
      return checks[Math.floor(Math.random() * checks.length)];
    }

    const development = moves.filter(
      (move) => move.piece !== "p" && this.isDevelopmentMove(move)
    );

    if (development.length > 0) {
      return development[Math.floor(Math.random() * development.length)];
    }

    return this.getBeginnerMove(moves);
  }

  private getMediumMove(chess: Chess, moves: Move[]): Move {
    const moveScores = moves.map((move) => ({
      move,
      score: this.evaluateMove(chess, move, false),
    }));

    moveScores.sort((a, b) => b.score - a.score);

    const topCount = Math.max(1, Math.ceil(moveScores.length * 0.4));
    const topMoves = moveScores.slice(0, topCount);

    return topMoves[Math.floor(Math.random() * topMoves.length)].move;
  }

  private getHardMove(chess: Chess, moves: Move[]): Move {
    const moveScores = moves.map((move) => ({
      move,
      score: this.evaluateMove(chess, move, true),
    }));

    moveScores.sort((a, b) => b.score - a.score);

    const topCount = Math.min(3, moveScores.length);
    const topMoves = moveScores.slice(0, topCount);

    return topMoves[Math.floor(Math.random() * topMoves.length)].move;
  }

  private evaluateMove(chess: Chess, move: Move, deep: boolean): number {
    let score = 0;

    const result = chess.move(move);

    const pieceValues: { [key: string]: number } = {
      p: 1,
      n: 3,
      b: 3,
      r: 5,
      q: 9,
      k: 0,
    };

    if (result.captured) {
      score += pieceValues[result.captured.toLowerCase()] * 10;

      const attackerValue = pieceValues[result.piece.toLowerCase()];
      const victimValue = pieceValues[result.captured.toLowerCase()];
      if (attackerValue < victimValue) {
        score += (victimValue - attackerValue) * 2;
      }
    }

    if (chess.inCheck()) {
      score += 5;
    }

    if (chess.isCheckmate()) {
      score += 1000;
      chess.undo();
      return score;
    }

    if (chess.isDraw()) {
      score -= 50;
    }

    if (["d4", "d5", "e4", "e5"].includes(result.to)) {
      score += 3;
    }

    if (
      [
        "c3",
        "c4",
        "c5",
        "c6",
        "d3",
        "d6",
        "e3",
        "e6",
        "f3",
        "f4",
        "f5",
        "f6",
      ].includes(result.to)
    ) {
      score += 1;
    }

    if (result.piece !== "p" && this.isDevelopmentMove(result)) {
      score += 2;
    }

    if (result.flags.includes("k") || result.flags.includes("q")) {
      score += 5;
    }

    if (result.piece === "p") {
      const rank = parseInt(result.to[1]);
      if (chess.turn() === "b") {
        score += (8 - rank) * 0.5;
      } else {
        score += (rank - 1) * 0.5;
      }

      if (["d", "e"].includes(result.to[0])) {
        score += 1;
      }
    }

    const attackers = this.getAttackers(chess, result.to);
    const defenders = this.getDefenders(chess, result.to);

    if (attackers.length > defenders.length) {
      const pieceValue = pieceValues[result.piece.toLowerCase()];
      score -= pieceValue * 3;
    }

    if (deep) {
      const opponentMoves = chess.moves({ verbose: true });

      if (opponentMoves.length < 40) {
        let bestOpponentScore = -1000;

        const sampleSize = Math.min(8, opponentMoves.length);
        const sampleMoves = this.sampleMoves(opponentMoves, sampleSize);

        for (const oppMove of sampleMoves) {
          const oppResult = chess.move(oppMove);
          let oppScore = 0;

          if (oppResult.captured) {
            oppScore += pieceValues[oppResult.captured.toLowerCase()] * 10;
          }
          if (chess.inCheck()) {
            oppScore += 5;
          }
          if (chess.isCheckmate()) {
            oppScore += 1000;
          }

          bestOpponentScore = Math.max(bestOpponentScore, oppScore);
          chess.undo();

          if (bestOpponentScore >= 1000) break;
        }

        score -= bestOpponentScore * 0.7;
      }
    }

    chess.undo();

    score += Math.random() * 0.1;

    return score;
  }

  private isDevelopmentMove(move: Move): boolean {
    const fromRank = parseInt(move.from[1]);
    const toRank = parseInt(move.to[1]);

    return (fromRank === 1 && toRank > 1) || (fromRank === 8 && toRank < 8);
  }

  private getAttackers(chess: Chess, square: Square): Move[] {
    return chess.moves({ verbose: true }).filter((move) => move.to === square);
  }

  private getDefenders(chess: Chess, square: Square): Square[] {
    const defenders: Square[] = [];
    const piece = chess.get(square);

    if (piece) {
      const attackers = this.getAttackers(chess, square);
      for (const attacker of attackers) {
        const defenderMoves = chess.moves({
          square: square as Square,
          verbose: true,
        });
        if (defenderMoves.some((def) => def.to === attacker.from)) {
          defenders.push(square);
        }
      }
    }

    return defenders;
  }

  private sampleMoves(moves: Move[], sampleSize: number): Move[] {
    if (moves.length <= sampleSize) {
      return moves;
    }

    const captures = moves.filter((m) => m.captured).slice(0, sampleSize / 2);
    const remaining = moves.filter((m) => !m.captured);
    const randomSample = remaining
      .sort(() => 0.5 - Math.random())
      .slice(0, sampleSize - captures.length);

    return [...captures, ...randomSample];
  }

  private getRealisticThinkingTime(movesCount?: number): number {
    const baseTimes = [
      1500, // Level 1 (Beginner): 1-2.5 seconds
      2500, // Level 2 (Easy): 2-4 seconds
      3500, // Level 3 (Medium): 2.5-5 seconds
      4500, // Level 4 (Hard): 3-6.5 seconds
    ];

    let baseTime = baseTimes[this.difficulty - 1];

    if (movesCount) {
      if (movesCount > 30) {
        baseTime += 1000; // +1 second for complex positions
      } else if (movesCount > 20) {
        baseTime += 500; // +0.5 seconds for moderately complex
      }
    }

    const variation = baseTime * 0.4;
    const thinkingTime = Math.floor(
      baseTime + (Math.random() - 0.5) * variation
    );

    return Math.max(1000, Math.min(8000, thinkingTime));
  }

  public quit(): void {
    logger.info("Lightweight chess engine shut down");
  }
}
