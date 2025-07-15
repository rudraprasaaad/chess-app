import WebSocket from "ws";
import { JsonValue } from "@prisma/client/runtime/library";

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
}

export enum RoomStatus {
  OPEN = "OPEN",
  ACTIVE = "ACITVE",
  CLOSED = "CLOSED",
}

export enum RoomType {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
}

export interface Player {
  userId: string;
  color: string;
}

export interface Room {
  id: string;
  type: RoomType;
  status: RoomStatus;
  players: { id: string; color: string | null }[];
  inviteCode?: string;
  createdAt: Date;
}

export interface RoomWithGame extends Room {
  game: Game;
}

export interface Game {
  id: string;
  roomId: string;
  fen: string;
  moveHistory: JsonValue[];
  timers: { white: number; black: number };
  status: GameStatus;
  players: Player[];
  chat: JsonValue[];
  winnerId?: string;
  createdAt: Date;
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
