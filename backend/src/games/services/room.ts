import { PrismaClient } from "../../generated/prisma";
import { WebSocketService } from "../../services/websocket";

export class RoomService {
  private prisma: PrismaClient;
  private ws: WebSocketService;
}
