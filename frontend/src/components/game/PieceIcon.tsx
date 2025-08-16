import wK from "../../assets/chess/king_white.svg";
import wKrot from "../../assets/chess/king_rotated_white.svg";
import wQ from "../../assets/chess/queen_white.svg";
import wQrot from "../../assets/chess/queen_rotated_white.svg";
import wR from "../../assets/chess/rook_white.svg";
import wRrot from "../../assets/chess/rook_rotated_white.svg";
import wB from "../../assets/chess/bishop_white.svg";
import wBrot from "../../assets/chess/bishop_rotated_white.svg";
import wN from "../../assets/chess/knight_white.svg";
import wNrot from "../../assets/chess/knight_rotated_white.svg";
import wP from "../../assets/chess/pawn_white.svg";
import wProt from "../../assets/chess/pawn_rotated_white.svg";

import bK from "../../assets/chess/king_black.svg";
import bKrot from "../../assets/chess/king_rotated_black.svg";
import bQ from "../../assets/chess/queen_black.svg";
import bQrot from "../../assets/chess/queen_rotated_black.svg";
import bR from "../../assets/chess/rook_black.svg";
import bRrot from "../../assets/chess/rook_rotated_black.svg";
import bB from "../../assets/chess/bishop_black.svg";
import bBrot from "../../assets/chess/bishop_rotated_black.svg";
import bN from "../../assets/chess/knight_black.svg";
import bNrot from "../../assets/chess/knight_rotated_black.svg";
import bP from "../../assets/chess/pawn_black.svg";
import bProt from "../../assets/chess/pawn_black_rotated.svg";
import { memo } from "react";

interface PieceIconProps {
  notation: string;
  size?: number;
  rotated?: boolean;
}

const pieceMap: Record<string, { normal: string; rotated: string }> = {
  // white Pieces
  K: { normal: wK, rotated: wKrot },
  Q: { normal: wQ, rotated: wQrot },
  R: { normal: wR, rotated: wRrot },
  B: { normal: wB, rotated: wBrot },
  N: { normal: wN, rotated: wNrot },
  P: { normal: wP, rotated: wProt },
  // Black pieces
  k: { normal: bK, rotated: bKrot },
  q: { normal: bQ, rotated: bQrot },
  r: { normal: bR, rotated: bRrot },
  b: { normal: bB, rotated: bBrot },
  n: { normal: bN, rotated: bNrot },
  p: { normal: bP, rotated: bProt },
};

const PieceIcon = ({
  notation,
  size = 40,
  rotated = false,
}: PieceIconProps) => {
  const piece = pieceMap[notation];

  if (!piece) return null;

  const src = rotated ? piece.rotated : piece.normal;

  return (
    <img
      src={src}
      alt={`Chess piece ${notation}`}
      width={size}
      height={size}
      draggable={false}
      style={{ userSelect: "none", pointerEvents: "none" }}
    />
  );
};

export default memo(PieceIcon);
