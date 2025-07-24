import { GameStatus, RoomStatus, RoomType } from "./common";

export interface Room {
  id: string;
  type: RoomType;
  status: RoomStatus;
  players: RoomPlayer[];
  inviteCode?: string;
  createdAt: Date;
}

export interface RoomPlayer {
  id: string;
  color: string | null;
}

export interface RoomWithGame extends Room {
  game: Game;
}

export interface CreateRoomPayload {
  type: RoomType;
  inviteCode?: string;
}

export interface JoinRoomPayload {
  roomId: string;
  inviteCode?: string;
}

export interface JoinQueuePayload {
  isGuest: boolean;
}

export interface Game {
  id: string;
  roomId: string;
  fen: string;
  moveHistory: [];
  timers: { white: number; black: number };
  status: GameStatus;
  players: { userId: string; color: string }[];
  chat: [];
  winnerId?: string;
  createdAt: Date;
}
