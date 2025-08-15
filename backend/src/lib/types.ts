/* eslint-disable @typescript-eslint/no-explicit-any */
import WebSocket from "ws";

export enum AuthProvider {
  GOOGLE = "GOOGLE",
  GUEST = "GUEST",
}

export enum UserStatus {
  OFFLINE = "OFFLINE",
  ONLINE = "ONLINE",
  WAITING = "WAITING",
  IN_GAME = "IN_GAME",
  DISCONNECTED = "DISCONNECTED",
}

export enum GameStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  ABANDONED = "ABANDONED",
  DRAW = "DRAW",
  RESIGNED = "RESIGNED",
}

export enum RoomStatus {
  OPEN = "OPEN",
  ACTIVE = "ACTIVE",
  CLOSED = "CLOSED",
}

export enum RoomType {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
}

export interface Move {
  from: string;
  to: string;
  promotion?: "q" | "r" | "b" | "n";
  san: string;
}

export interface ChatMessage {
  playerId: string;
  text: string;
  timestamp: number;
}

export interface TimeControl {
  initial: number;
  increment: number;
}

export interface Player {
  userId: string;
  color: string;
  name: string | null;
}

export interface Room {
  id: string;
  type: RoomType;
  status: RoomStatus;
  players: { id: string; color: string | null }[];
  inviteCode?: string;
  createdAt: Date;
}

export interface Game {
  id: string;
  roomId: string;
  fen: string;
  moveHistory: Move[];
  timers: { white: number; black: number };
  timeControl: TimeControl;
  status: GameStatus;
  players: { userId: string; color: string }[];
  chat: ChatMessage[];
  winnerId?: string;
  createdAt: Date;
}

export interface RoomWithGame extends Room {
  game: Game;
}

export interface WebSocketMessage {
  type: string;
  payload: any;
}

export interface AuthenticatedWebSocket extends WebSocket {
  playerId: string;
  gameId?: string;
  roomId?: string;
}
