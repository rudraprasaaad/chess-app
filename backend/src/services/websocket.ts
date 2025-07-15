import WebSocket, { WebSocketServer } from "ws";
import jwt from "jsonwebtoken";
import { LoggerService } from "./logger";
import { GameService } from "../games/services/game";
import { AuthProvider } from "../generated/prisma";
import { AuthenticatedWebSocket } from "../lib/types";

export class WebSocketService {
  private wss: WebSocketServer;
  private logger: LoggerService;
  private gameService: GameService;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.logger = new LoggerService();
    this.gameService = new GameService(this);
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
        this.logger.info(`Client Connected: ${user.id}`);

        // add create roomService

        // await this.roomService.handleReconnect(ws);

        ws.on("error", (err) => {
          this.logger.error(
            `Websocket Error for ${ws.playerId}: ${err.message}`
          );
        });

        ws.on("message", (data) => this.handleMessage(ws, data));

        ws.on("close", () => this.roomService.handleDisconnect(ws));
      } catch (err) {
        this.logger.error(`Connection error:${(err as Error).message} `);
        ws.close(4000, "Authentication failed");
      }
    });
  }
}
