import { Chess, Move as ChessMove } from "chess.js";

const evaluateBoard = (chess: Chess): number => {
  const pieceValues: { [key: string]: number } = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
  };

  let totalEvaluation = 0;
  const board = chess.board();

  for (let i = 0; i < 8; i++) {
    for (let j = 0; j < 8; j++) {
      const piece = board[i][j];
      if (piece) {
        const value = pieceValues[piece.type] * (piece.color === "w" ? 1 : -1);
        totalEvaluation += value;
      }
    }
  }
  return totalEvaluation;
};

const minimax = (
  chess: Chess,
  depth: number,
  isMaximizing: boolean,
  alpha: number = -Infinity,
  beta: number = Infinity
): number => {
  if (depth === 0 || chess.isGameOver()) return evaluateBoard(chess);

  const possibleMoves = chess.moves();
  let bestValue = isMaximizing ? -Infinity : Infinity;

  for (const move of possibleMoves) {
    chess.move(move);
    const value = minimax(chess, depth - 1, !isMaximizing, alpha, beta);
    chess.undo();

    if (isMaximizing) {
      bestValue = Math.max(bestValue, value);
      alpha = Math.max(alpha, value);
    } else {
      bestValue = Math.min(bestValue, value);
      beta = Math.min(beta, value);
    }
    if (beta <= alpha) break;
  }
  return bestValue;
};

export const findBestMove = (chess: Chess, depth: number): ChessMove | null => {
  const possibleMoves = chess.moves({ verbose: true });
  if (possibleMoves.length === 0) return null;

  let bestMove: ChessMove | null = null;

  let bestValue = -Infinity;
  const isBotMaximizing = chess.turn() === "w";

  for (const move of possibleMoves) {
    chess.move(move.san);
    const boardValue = minimax(
      chess,
      depth - 1,
      !isBotMaximizing,
      -Infinity,
      Infinity
    );
    chess.undo();

    const moveScore = isBotMaximizing ? boardValue : -boardValue;

    if (moveScore > bestValue) {
      bestValue = moveScore;
      bestMove = move;
    }
  }

  if (bestMove && Math.random() < 0.2) {
    bestMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
  }

  return (
    bestMove || possibleMoves[Math.floor(Math.random() * possibleMoves.length)]
  );
};
