import { GameStatus } from "./common";
import { Square } from "chess.js";

export interface Game {
  id: string;
  roomId: string;
  fen: string;
  moveHistory: Move[];
  timers: { white: number; black: number };
  status: GameStatus;
  players: GamePlayer[];
  chat: ChatMessage[];
  winnerId?: string;
  createdAt: Date;
}

export interface GamePlayer {
  userId: string;
  color: string;
}

export interface Move {
  from: Square;
  to: Square;
  san?: string;
}

export interface ChatMessage {
  playerId: string;
  text: string;
  timestamp: number;
}

export interface MakeMovePayload {
  gameId: string;
  move: {
    from: Square;
    to: Square;
    promotion?: "q" | "r" | "b" | "n";
  };
}

export interface SendChatPayload {
  gameId: string;
  message: string;
}

export type GameResult = "white" | "black" | "draw";

export type GameEndReason =
  | "checkmate"
  | "stalemate"
  | "timeout"
  | "resignation"
  | "draw_agreement"
  | "insufficient_material"
  | "threefold_repetition"
  | "fifty_move_rule"
  | "abandonment";

export interface TimerSettings {
  white: number;
  black: number;
}

export const GAME_CONSTANTS = {
  DEFAULT_TIME_PER_PLAYER: 600,
  MAX_INVALID_MOVES: 3,
  CHAT_MESSAGE_MAX_LENGTH: 500,
  CHAT_RATE_LIMIT: 50,
} as const;
