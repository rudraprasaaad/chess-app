/* eslint-disable @typescript-eslint/no-explicit-any */
import { Square } from "chess.js";
import { RoomType } from "./common";
import type { Game, Room, RoomWithGame } from "./room";

export interface WebSocketMessage<T = any> {
  type: string;
  payload: T;
}

export interface CreateRoomMessage {
  type: "CREATE_ROOM";
  payload: {
    type: RoomType;
    inviteCode?: string;
  };
}

export interface JoinRoomMessage {
  type: "JOIN_ROOM";
  payload: {
    roomId: string;
    inviteCode?: string;
  };
}

export interface LeaveRoomMessage {
  type: "LEAVE_ROOM";
  payload: {
    roomId: string;
  };
}

export interface JoinQueueMessage {
  type: "JOIN_QUEUE";
  payload: {
    isGuest: boolean;
  };
}

export interface LeaveQueueMessage {
  type: "LEAVE_QUEUE";
  payload: object;
}

export interface MakeMoveMessage {
  type: "MAKE_MOVE";
  payload: {
    gameId: string;
    move: {
      from: Square;
      to: Square;
    };
  };
}

export interface LoadGameMessage {
  type: "LOAD_GAME";
  payload: {
    gameId: string;
  };
}

export interface ResignGameMessage {
  type: "RESIGN_GAME";
  payload: {
    gameId: string;
  };
}

export interface RequestRejoinMessage {
  type: "REQUEST_REJOIN";
  payload: {
    gameId: string;
  };
}

export interface GetLegalMoveMessage {
  type: "GET_LEGAL_MOVES";
  payload: {
    gameId: string;
    square: Square;
  };
}

export interface ChatMessage {
  type: "CHAT_MESSAGE";
  payload: {
    gameId: string;
    message: string;
  };
}

export interface TypingMessage {
  type: "TYPING";
  payload: {
    gameId: string;
  };
}

export interface OfferDrawMessage {
  type: "OFFER_DRAW";
  payload: {
    gameId: string;
  };
}

export interface AcceptDrawMessage {
  type: "ACCEPT_DRAW";
  payload: {
    gameId: string;
  };
}

export interface DeclineDrawMessage {
  type: "DECLINE_DRAW";
  payload: {
    gameId: string;
  };
}

export type ClientMessage =
  | CreateRoomMessage
  | JoinRoomMessage
  | LeaveRoomMessage
  | JoinQueueMessage
  | LeaveQueueMessage
  | MakeMoveMessage
  | LoadGameMessage
  | ResignGameMessage
  | RequestRejoinMessage
  | GetLegalMoveMessage
  | ChatMessage
  | TypingMessage
  | OfferDrawMessage
  | AcceptDrawMessage
  | DeclineDrawMessage;

export interface RoomCreatedMessage {
  type: "ROOM_CREATED";
  payload: Room;
}

export interface RoomUpdatedMessage {
  type: "ROOM_UPDATED";
  payload: RoomWithGame;
}

export interface GameUpdatedMessage {
  type: "GAME_UPDATED";
  payload: Game;
}

export interface RejoinGameMessage {
  type: "REJOIN_GAME";
  payload: Game;
}

export interface QueueTimeoutMessage {
  type: "QUEUE_TIMEOUT";
  payload: {
    message: string;
  };
}

export interface QueueLeftMessage {
  type: "QUEUE_LEFT";
  payload: object;
}

export interface ErrorMessage {
  type: "ERROR";
  payload: {
    message: string;
  };
}

export interface TypingBroadcastMessage {
  type: "TYPING";
  payload: {
    gameId: string;
    playerId: string;
  };
}

export type ServerMessage =
  | RoomCreatedMessage
  | RoomUpdatedMessage
  | GameUpdatedMessage
  | RejoinGameMessage
  | QueueTimeoutMessage
  | QueueLeftMessage
  | ErrorMessage
  | TypingBroadcastMessage;

export type AnyWebSocketMessage = ClientMessage | ServerMessage;

export const RATE_LIMIT = {
  MAX_MESSAGES_PER_MINUTE: 50,
  WINDOW_MS: 60000,
} as const;

export const WS_CLOSE_CODES = {
  AUTH_FAILED: 4001,
  RATE_LIMIT_EXCEEDED: 4001,
  INVALID_MESSAGE: 4002,
  NOT_FOUND: 4003,
  UNAUTHORIZED: 4004,
} as const;
