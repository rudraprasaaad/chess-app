import { motion } from "framer-motion";
import { useCallback, useMemo } from "react";
import { useGameActions, useGameStore } from "../../store/game";
import { useWebSocketSender } from "../../store/websocket";
import classNames from "classnames";
import PieceIcon from "./PieceIcon";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

function fenToBoard(fen: string): Record<string, string | null> {
  const rows = fen.split(" ")[0].split("/");
  const board: Record<string, string | null> = {};

  for (let r = 0; r < 8; r++) {
    let fileIndex = 0;
    for (const char of rows[r]) {
      if (isNaN(Number(char))) {
        const square = files[fileIndex] + (8 - r);
        board[square] = char;
        fileIndex++;
      } else {
        const emptyCount = parseInt(char, 10);
        for (let i = 0; i < emptyCount; i++) {
          const square = files[fileIndex] + (8 - r);
          board[square] = null;
          fileIndex++;
        }
      }
    }
  }

  return board;
}

const isLightSquare = (file: string, rank: number) =>
  (files.indexOf(file) + rank) % 2 === 1;

const ChessBoard = () => {
  const fen = useGameStore((state) => state.currentGame?.fen || "");
  const selectedSquare = useGameStore((state) => state.selectedSquare);
  const legalMoves = useGameStore((state) => state.legalMoves);
  const lastMove = useGameStore((state) => state.lastMove);
  const currentGame = useGameStore((state) => state.currentGame);
  const isPlayerTurn = useGameStore((state) => state.isPlayerTurn);
  const playerColor = useGameStore((state) => state.playerColor);
  const isMakingMove = useGameStore((state) => state.isMakingMove);
  const setSelectedSquare = useGameActions().setSelectedSquare;
  const clearSelection = useGameActions().clearSelection;
  const sendMessage = useWebSocketSender().sendMessage;

  const board = useMemo(() => fenToBoard(fen), [fen]);

  const isOwnedPiece = useCallback(
    (piece: string | null) => {
      if (!piece || !playerColor) return false;

      const isWhitePiece = piece === piece.toUpperCase();
      return (
        (playerColor === "white" && isWhitePiece) ||
        (playerColor === "black" && !isWhitePiece)
      );
    },
    [playerColor]
  );

  const onSquareClick = useCallback(
    (square: string) => {
      if (!currentGame || !isPlayerTurn || isMakingMove) return;

      const piece = board[square];

      if (piece && !isOwnedPiece(piece)) {
        clearSelection();
        return;
      }

      if (selectedSquare === square) {
        clearSelection();
        return;
      }

      if (selectedSquare && legalMoves.includes(square)) {
        sendMessage({
          type: "MAKE_MOVE",
          payload: {
            gameId: currentGame.id,
            move: { from: selectedSquare, to: square },
          },
        });
        clearSelection();
        return;
      }

      if (piece && isOwnedPiece(piece)) {
        setSelectedSquare(square);
      } else {
        clearSelection();
      }
    },
    [
      currentGame,
      isPlayerTurn,
      isMakingMove,
      board,
      selectedSquare,
      legalMoves,
      isOwnedPiece,
      setSelectedSquare,
      clearSelection,
      sendMessage,
    ]
  );

  return (
    <div
      className="grid grid-cols-8 gap-0 w-full max-w-[480px] border border-gray-300 rounded-md select-none"
      role="grid"
      aria-label="Chessboard"
    >
      {ranks.map((rank) =>
        files.map((file) => {
          const square = file + rank;
          const piece = board[square];
          const isLight = isLightSquare(file, rank);
          const isSelected = selectedSquare === square;
          const isLegal = legalMoves.includes(square);
          const isLastMoveSquare =
            lastMove && (lastMove.from === square || lastMove.to === square);

          const squareClass = classNames(
            "w-12 h-12 flex items-center justify-center cursor-pointer",
            isLight ? "bg-yellow-100" : "bg-green-700",
            isSelected && "ring-4 ring-yellow-400",
            isLegal && "bg-green-400/70",
            isLastMoveSquare && "bg-yellow=300/40",
            !isPlayerTurn && "cursor-not-allowed opacity-60",
            isMakingMove && "pointer-events-none"
          );

          return (
            <motion.div
              key={square}
              className={squareClass}
              onClick={() => onSquareClick(square)}
              role="gridcell"
              aria-label={`Square ${square}${
                piece ? `with piece ${piece}` : ""
              }`}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onSquareClick(square);
                }
              }}
              whileHover={isPlayerTurn ? { scale: 1.05 } : undefined}
              whileTap={isPlayerTurn ? { scale: 0.95 } : undefined}
            >
              {piece && (
                <motion.div
                  initial={{ scale: 0.8 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <PieceIcon notation={piece} size={40} />
                </motion.div>
              )}

              {isLegal && !piece && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute inset-0 border-4 border-green-500 rounded-sm opacity-60 pointer-events-none"
                />
              )}
            </motion.div>
          );
        })
      )}
    </div>
  );
};

export default ChessBoard;
