import WebSocket, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";

import { logger } from "./logger";

import { GameService } from "../games/services/game";
import { RoomService } from "../games/services/room";

import {
  AuthenticatedWebSocket,
  AuthProvider,
  Game,
  Room,
  WebSocketMessage,
} from "../lib/types";
import { ChatService } from "../games/services/chat";

export class WebSocketService {
  private wss: WebSocketServer;
  private gameService: GameService;
  private roomService: RoomService;
  private chatService: ChatService;
  private rateLimit: Map<string, { count: number; lastReset: number }>;
  private connections: Map<string, AuthenticatedWebSocket>;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.gameService = new GameService(this);
    this.roomService = new RoomService(this);
    this.chatService = new ChatService(this);
    this.rateLimit = new Map();
    this.connections = new Map();
    this.setupEventHandlers();
    this.setupHeartbeat();
  }

  private async verifyToken(
    token: string
  ): Promise<{ id: string; provider: AuthProvider }> {
    return new Promise((resolve, reject) => {
      jwt.verify(token, process.env.JWT_SECRET!, (err, decoded) => {
        if (err) reject(new Error("Invalid token"));
        resolve(decoded as { id: string; provider: AuthProvider });
      });
    });
  }

  private parseCookies(cookieHeader?: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) return {};

    cookieHeader.split(";").forEach((cookie) => {
      const [name, value] = cookie.trim().split("=");
      cookies[name] = value;
    });

    return cookies;
  }

  private setupHeartbeat(): void {
    setInterval(() => {
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      });
    }, 30000);
  }

  private async setupEventHandlers(): Promise<void> {
    this.wss.on("connection", async (ws: AuthenticatedWebSocket, req) => {
      try {
        const cookies = this.parseCookies(req.headers.cookie);
        const token = cookies["guest"] || cookies["jwt"];

        if (!token) throw new Error("No token provided");
        const user = await this.verifyToken(token);

        ws.playerId = user.id;
        this.connections.set(user.id, ws);

        logger.info(`Client Connected: ${user.id}`);

        await this.roomService.handleReconnect(ws);

        ws.on("error", (err) => {
          logger.error(`Websocket Error for ${ws.playerId}: ${err.message}`);
        });

        ws.on("message", (data) => this.handleMessage(ws, data));

        ws.on("close", () => {
          this.connections.delete(ws.playerId);
          this.roomService.handleDisconnect(ws);
        });
      } catch (err) {
        logger.error(`Connection error: ${(err as Error).message}`);
        ws.close(4001, "Authentication failed");
      }
    });
  }

  private async handleMessage(
    ws: AuthenticatedWebSocket,
    data: WebSocket.RawData
  ): Promise<void> {
    try {
      const now = Date.now();

      // Rate limiting
      const limit = this.rateLimit.get(ws.playerId) || {
        count: 0,
        lastReset: now,
      };

      if (now - limit.lastReset > 60000) {
        limit.count = 0;
        limit.lastReset = now;
      }

      if (limit.count >= 50) {
        ws.close(4001, "Rate limit exceeded");
        return;
      }

      limit.count++;
      this.rateLimit.set(ws.playerId, limit);

      let message: WebSocketMessage;
      try {
        message = JSON.parse(data.toString());
      } catch (parseErr) {
        throw new Error("Invalid JSON format");
      }

      const { type, payload } = message;

      if (!type) {
        throw new Error("Message type is required");
      }

      logger.info(`Message from ${ws.playerId}: ${type}`);

      switch (type) {
        case "CREATE_ROOM":
          await this.roomService.createRoom(
            payload.type,
            ws.playerId,
            payload.inviteCode
          );
          break;

        case "JOIN_ROOM":
          await this.roomService.joinRoom(
            payload.roomId,
            ws.playerId,
            payload.inviteCode
          );
          break;

        case "JOIN_QUEUE":
          await this.roomService.joinQueue(ws.playerId, payload.isGuest);
          break;

        case "LEAVE_QUEUE":
          await this.roomService.leaveQueue(ws.playerId);
          break;

        case "MAKE_MOVE":
          await this.gameService.makeMove(
            payload.gameId,
            ws.playerId,
            payload.move
          );
          break;

        case "CHAT_MESSAGE":
          await this.chatService.sendChatMessage(
            payload.gameId,
            ws.playerId,
            payload.message
          );
          break;

        case "TYPING":
          await this.chatService.broadCastTyping(payload.gameId, ws.playerId);
          break;

        default:
          throw new Error(`Unknown message type: ${type}`);
      }
    } catch (err) {
      logger.error(`Message handling error: ${(err as Error).message}`);
      this.broadcastToClient(ws.playerId, {
        type: "ERROR",
        payload: { message: (err as Error).message },
      });
    }
  }

  public broadcastToClient(playerId: string, message: WebSocketMessage): void {
    const client = this.connections.get(playerId);
    if (client && client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(message));
    }
  }

  public broadcastToRoom(room: Room): void {
    room.players.forEach((player) => {
      this.broadcastToClient(player.id, {
        type: "ROOM_UPDATED",
        payload: room,
      });
    });
  }

  public broadcastToGame(game: Game): void {
    game.players.forEach((player) => {
      this.broadcastToClient(player.userId, {
        type: "GAME_UPDATED",
        payload: game,
      });
    });
  }

  public getConnectionCount(): number {
    return this.connections.size;
  }
}
