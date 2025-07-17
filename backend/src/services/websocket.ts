import WebSocket, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { logger } from "./logger";
import { GameService } from "../games/services/game";
import { AuthProvider } from "../generated/prisma";
import {
  AuthenticatedWebSocket,
  Game,
  Room,
  WebSocketMessage,
} from "../lib/types";
import { RoomService } from "../games/services/room";

export class WebSocketService {
  private wss: WebSocketServer;
  private gameService: GameService;
  private roomService: RoomService;
  private rateLimit: Map<string, { count: number; lastReset: number }>;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.gameService = new GameService(this);
    this.roomService = new RoomService(this);
    this.rateLimit = new Map();
    this.setupEventHandlers();
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

  private async setupEventHandlers(): Promise<void> {
    this.wss.on("connection", async (ws: AuthenticatedWebSocket, req) => {
      try {
        const url = new URL(req.url!, "http://localhost");
        const token = url.searchParams.get("token");

        if (!token) throw new Error("No token provided");
        const user = await this.verifyToken(token);

        ws.playerId = user.id;
        logger.info(`Client Connected: ${user.id}`);

        // add create roomService

        // await this.roomService.handleReconnect(ws);

        ws.on("error", (err) => {
          logger.error(`Websocket Error for ${ws.playerId}: ${err.message}`);
        });

        ws.on("message", (data) => this.handleMessage(ws, data));

        // ws.on("close", () => this.roomService.handleDisconnect(ws));
      } catch (err) {
        logger.error(`Connection error:${(err as Error).message} `);
        ws.close(4000, "Authentication failed");
      }
    });
  }

  private async handleMessage(
    ws: AuthenticatedWebSocket,
    data: WebSocket.RawData
  ): Promise<void> {
    try {
      const now = Date.now();

      const limit = this.rateLimit.get(ws.playerId) || {
        count: 0,
        lastReset: now,
      };
      if (now - limit.lastReset > 60000) {
        limit.count = 0;
        limit.lastReset = now;
      }

      if (limit.count >= 50) {
        ws.close(4000, "Authentication failed");
        return;
      }
      limit.count++;
      this.rateLimit.set(ws.playerId, limit);

      const { type, payload }: WebSocketMessage = JSON.parse(data.toString());
      logger.info(`Message from ${ws.playerId}: ${type}`);

      switch (type) {
        case "CREATE_ROOM":
          await this.roomService.createRoom(
            payload.type,
            payload.playerId,
            payload.inviteCode
          );
          break;

        case "JOIN_ROOM":
          await this.roomService.joinRoom(
            payload.roomId,
            payload.playerId,
            payload.inviteCode
          );
          break;

        case "JOIN_QUEUE":
          break;

        case "MAKE_MOVE":
          break;

        case "CHAT_MESSAGE":
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

  public broadcastToRoom(room: Room): void {
    this.wss.clients.forEach((client) => {
      if (
        room.players.some(
          (p) => p.id === (client as AuthenticatedWebSocket).playerId
        )
      ) {
        client.send(JSON.stringify({ type: "ROOM_UPDATED", payload: room }));
      }
    });
  }

  public broadcastToGame(game: Game): void {
    this.wss.clients.forEach((client) => {
      if (
        game.players.some(
          (p) => p.userId === (client as AuthenticatedWebSocket).playerId
        )
      ) {
        client.send(JSON.stringify({ type: "GAME_UPDATED", payload: game }));
      }
    });
  }

  public broadcastToClient(playerId: string, message: WebSocketMessage): void {
    this.wss.clients.forEach((client) => {
      if ((client as AuthenticatedWebSocket).playerId === playerId) {
        client.send(JSON.stringify(message));
      }
    });
  }
}
