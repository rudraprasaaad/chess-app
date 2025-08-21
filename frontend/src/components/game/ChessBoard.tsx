import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useMemo } from "react";
import { useGameActions, useGameStore } from "../../store/game";
import { useWebSocketSender } from "../../store/websocket";
import { cn } from "../../lib/utils";
import PieceIcon from "./PieceIcon";
import { Square } from "chess.js";

const defaultFiles = ["a", "b", "c", "d", "e", "f", "g", "h"];
const defaultRanks = [8, 7, 6, 5, 4, 3, 2, 1];

function fenToBoard(fen: string): Record<string, string | null> {
  const fenBoard = fen.split(" ")[0];
  if (!fenBoard) return {};

  const rows = fenBoard.split("/");
  const board: Record<string, string | null> = {};

  for (let r = 0; r < 8; r++) {
    let fileIndex = 0;
    const currentRow = rows[r];
    if (!currentRow) continue;

    for (const char of currentRow) {
      if (isNaN(Number(char))) {
        const square = defaultFiles[fileIndex] + (8 - r);
        board[square] = char;
        fileIndex++;
      } else {
        const emptyCount = parseInt(char, 10);
        for (let i = 0; i < emptyCount; i++) {
          const square = defaultFiles[fileIndex] + (8 - r);
          board[square] = null;
          fileIndex++;
        }
      }
    }
  }

  return board;
}

const isLightSquare = (file: string, rank: number) =>
  (defaultFiles.indexOf(file) + rank) % 2 === 1;

interface ChessBoardProps {
  boardOrientation?: "white" | "black";
}

const ChessBoard = ({ boardOrientation = "white" }: ChessBoardProps) => {
  const fen = useGameStore((state) => state.currentGame?.fen || "");
  const selectedSquare = useGameStore((state) => state.selectedSquare);
  const legalMoves = useGameStore((state) => state.legalMoves);
  const currentGame = useGameStore((state) => state.currentGame);
  const setSelectedSquare = useGameActions().setSelectedSquare;
  const clearSelection = useGameActions().clearSelection;
  const sendMessage = useWebSocketSender().sendMessage;

  const board = useMemo(() => fenToBoard(fen), [fen]);

  const ranks = useMemo(
    () =>
      boardOrientation === "white" ? defaultRanks : [...defaultRanks].reverse(),
    [boardOrientation]
  );
  const files = useMemo(
    () =>
      boardOrientation === "white" ? defaultFiles : [...defaultFiles].reverse(),
    [boardOrientation]
  );

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
            move: { from: selectedSquare as Square, to: square as Square },
          },
        });
        return;
      }

      if (board[square]) {
        setSelectedSquare(square as Square);
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
    <div className="flex items-center justify-center w-full h-full">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative w-full h-full max-w-[500px] max-h-[500px] aspect-square"
      >
        <div
          className="grid grid-cols-8 grid-rows-8 w-full h-full border border-white/10 rounded-xl overflow-hidden shadow-2xl bg-card select-none"
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
                    "w-full h-full flex items-center justify-center cursor-pointer relative transition-all duration-300",
                    isLight
                      ? "bg-amber-50 hover:bg-amber-100"
                      : "bg-amber-700 hover:bg-amber-600",
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
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
                        className="relative z-10 w-[75%] h-[75%]"
                      >
                        <PieceIcon notation={piece} />
                      </motion.div>
                    )}
                  </AnimatePresence>

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
                        className="w-[30%] h-[30%] bg-primary rounded-full absolute"
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

        {files.map((file, index) => (
          <span
            key={file}
            className="text-xs text-muted-foreground font-medium absolute -bottom-5"
            style={{
              left: `${(index + 0.5) * 12.5}%`,
              transform: "translateX(-50%)",
            }}
          >
            {file}
          </span>
        ))}
        {ranks.map((rank, index) => (
          <span
            key={rank}
            className="text-xs text-muted-foreground font-medium absolute -left-5"
            style={{
              top: `${(index + 0.5) * 12.5}%`,
              transform: "translateY(-50%)",
            }}
          >
            {rank}
          </span>
        ))}
      </motion.div>
    </div>
  );
};

export default ChessBoard;
