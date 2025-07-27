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
  const selecetedSquare = useGameStore((state) => state.selectedSquare);
  const legalMoves = useGameStore((state) => state.legalMoves);
  const currentGame = useGameStore((state) => state.currentGame);
  const setSelectedSquare = useGameActions().setSelectedSquare;
  const clearSection = useGameActions().clearSection;

  const sendMessage = useWebSocketSender().sendMessage;

  const board = useMemo(() => fenToBoard(fen), [fen]);

  const onSquareClick = useCallback(
    (square: string) => {
      if (!currentGame) return;

      if (selecetedSquare === square) {
        clearSection();
        return;
      }

      if (selecetedSquare && legalMoves.includes(square)) {
        sendMessage({
          type: "MAKE_MOVE",
          payload: {
            gameId: currentGame.id,
            move: { from: selecetedSquare, to: square },
          },
        });
        clearSection();
        return;
      }

      if (board[square]) {
        setSelectedSquare(square);
      } else {
        clearSection();
      }
    },
    [
      selecetedSquare,
      legalMoves,
      board,
      setSelectedSquare,
      clearSection,
      sendMessage,
      currentGame,
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
          const isSelected = selecetedSquare === square;
          const isLegal = legalMoves.includes(square);

          const squareClass = classNames(
            "w-12 h-12 flex items-center justify-center cursor-pointer",
            isLight ? "bg-yellow-100" : "bg-green-700",
            isSelected && "ring-4 ring-yellow-400",
            isLegal && "bg-green-400/70"
          );

          return (
            <div
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
            >
              {piece && <PieceIcon notation={piece} size={40} />}
            </div>
          );
        })
      )}
    </div>
  );
};

export default ChessBoard;
