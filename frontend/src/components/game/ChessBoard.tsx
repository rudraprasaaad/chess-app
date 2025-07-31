import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo } from "react";
import { useGameActions, useGameStore } from "../../store/game";
import { useWebSocketSender } from "../../store/websocket";
import { cn } from "../../lib/utils";
import PieceIcon from "./PieceIcon";

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ranks = [8, 7, 6, 5, 4, 3, 2, 1];

function fenToBoard(fen: string): Record<string, string | null> {
  const fenBoard = fen.split(" ")[0]; // part before space is board layout
  if (!fenBoard) {
    console.warn("Empty or invalid FEN:", fen);
    return {};
  }

  const rows = fenBoard.split("/");
  if (rows.length !== 8) {
    console.warn("Invalid FEN rows count:", rows.length, fen);
    return {};
  }

  const board: Record<string, string | null> = {};

  for (let r = 0; r < 8; r++) {
    let fileIndex = 0;
    const currentRow = rows[r];

    if (!currentRow) {
      console.warn(`Missing row ${r} in FEN:`, fen);
      continue; // skip invalid rows
    }

    for (const char of currentRow) {
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
  const currentGame = useGameStore((state) => state.currentGame);
  const setSelectedSquare = useGameActions().setSelectedSquare;
  const clearSelection = useGameActions().clearSelection;
  const sendMessage = useWebSocketSender().sendMessage;

  useEffect(() => {
    console.log("Current game or FEN changed:", currentGame, fen);
  }, [currentGame, fen]);

  const board = useMemo(() => fenToBoard(fen), [fen]);

  const onSquareClick = useCallback(
    (square: string) => {
      if (!currentGame) return;

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

      if (board[square]) {
        setSelectedSquare(square);
      } else {
        clearSelection();
      }
    },
    [
      selectedSquare,
      legalMoves,
      board,
      setSelectedSquare,
      clearSelection,
      sendMessage,
      currentGame,
    ]
  );

  if (!fen) {
    return (
      <div className="flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass p-6 rounded-xl"
        >
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading board...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative"
      >
        <div
          className="grid grid-cols-8 gap-0 w-96 h-96 border border-white/10 rounded-xl overflow-hidden shadow-2xl bg-card select-none"
          role="grid"
          aria-label="Chessboard"
        >
          {ranks.map((rank, rankIndex) =>
            files.map((file, fileIndex) => {
              const square = file + rank;
              const piece = board[square];
              const isLight = isLightSquare(file, rank);
              const isSelected = selectedSquare === square;
              const isLegal = legalMoves.includes(square);

              return (
                <motion.div
                  key={square}
                  className={cn(
                    "w-12 h-12 flex items-center justify-center cursor-pointer relative transition-all duration-300",
                    isLight
                      ? "bg-chess-light hover:bg-chess-light/80"
                      : "bg-chess-dark hover:bg-chess-dark/80",
                    isSelected &&
                      "ring-2 ring-chess-gold shadow-lg bg-chess-gold/20",
                    isLegal && !piece && "bg-primary/20",
                    isLegal && piece && "bg-destructive/20"
                  )}
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
                  whileHover={{ scale: 1.05, transition: { duration: 0.2 } }}
                  whileTap={{ scale: 0.95, transition: { duration: 0.1 } }}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    delay: (rankIndex * 8 + fileIndex) * 0.01,
                    duration: 0.3,
                  }}
                >
                  <AnimatePresence mode="wait">
                    {piece && (
                      <motion.div
                        key={`${piece}-${square}`}
                        initial={{ scale: 0, rotate: 180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        exit={{ scale: 0, rotate: -180 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 25,
                          duration: 0.4,
                        }}
                        className="relative z-10"
                      >
                        <PieceIcon notation={piece} size={32} />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Legal move indicators */}
                  <AnimatePresence>
                    {isLegal && !piece && (
                      <motion.div
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 0.8 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 20,
                        }}
                        className="w-3 h-3 bg-primary rounded-full absolute"
                      />
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {isLegal && piece && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        exit={{ scale: 0 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 20,
                        }}
                        className="absolute inset-1 border-2 border-destructive rounded-sm opacity-70 pointer-events-none"
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })
          )}
        </div>

        {/* External Board Labels */}
        <div className="absolute -bottom-6 left-0 right-0 flex justify-between px-3">
          {files.map((file) => (
            <span
              key={file}
              className="text-xs text-muted-foreground font-medium w-12 text-center"
            >
              {file}
            </span>
          ))}
        </div>
        <div className="absolute -left-6 top-0 bottom-0 flex flex-col justify-between py-3">
          {ranks.map((rank) => (
            <span
              key={rank}
              className="text-xs text-muted-foreground font-medium h-12 flex items-center"
            >
              {rank}
            </span>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default ChessBoard;
