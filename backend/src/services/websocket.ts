import WebSocket, { WebSocketServer } from "ws";
import { LoggerService } from "./logger";

export class WebSocketService {
  private wss: WebSocketServer;
  private logger: LoggerService;

  constructor(wss: WebSocketServer) {
    this.wss = wss;
    this.logger = new LoggerService();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.wss.on("connection", (ws: WebSocket) => {
      this.logger.info("Client connected!!!");
    });
  }
}
