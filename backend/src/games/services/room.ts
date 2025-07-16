import { prisma } from "../../lib/prisma";
import { Room, RoomStatus, RoomType, UserStatus } from "../../lib/types";
import { redis } from "../../services/redis";
import { WebSocketService } from "../../services/websocket";
import { GameService } from "./game";

export class RoomService {
  private ws: WebSocketService;
  private gameService: GameService;

  constructor(ws: WebSocketService) {
    this.ws = ws;
    this.gameService = new GameService(ws);
  }

  async createRoom(
    type: RoomType,
    playerId: string,
    inviteCode?: string
  ): Promise<void> {
    let code: string | undefined;

    if (type === RoomType.PRIVATE)
      code = inviteCode || Math.random().toString(36).slice(2, 8).toUpperCase();

    const room = await prisma.room.create({
      data: {
        type,
        status: RoomStatus.OPEN,
        players: [{ id: playerId, color: null }],
        inviteCode: code,
      },
    });

    const typedRoom: Room = {
      id: room.id,
      type: room.type as RoomType,
      status: room.status as RoomStatus,
      players: room.players as { id: string; color: string | null }[],
      inviteCode: room.inviteCode || undefined,
      createdAt: room.createdAt,
    };

    await redis.set(`room:${room.id}`, JSON.stringify(typedRoom));
    await prisma.user.update({
      where: {
        id: playerId,
      },
      data: {
        status: UserStatus.WAITING,
      },
    });
    await redis.set(`player:${playerId}:status`, UserStatus.WAITING);
    this.ws.broadcastToClient(playerId, {
      type: "ROOM_CREATED",
      payload: typedRoom,
    });
  }

  async joinRoom(
    roomId: string,
    playerId: string,
    inviteCode?: string
  ): Promise<void> {
    try {
      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) throw new Error("Room not found");

      if (room.type === RoomType.PRIVATE && inviteCode !== room.inviteCode) {
        throw new Error("Invalid invite code!!");
      }

      if (room.status !== RoomStatus.OPEN) {
        throw new Error("Room is not open");
      }

      if (room.players.some((p: any) => p.id === playerId)) {
        throw new Error("Player already in room");
      }

      if (room.players.length >= 2) {
        throw new Error("Room is full");
      }

      const players = (
        room.players as { id: string; color: string | null }[]
      ).concat({ id: playerId, color: null });
      const colors = ["white", "black"].sort(() => Math.random() - 0.5);
      players[0].color = colors[0];
      players[1].color = colors[1];

      const updatedRoom = await prisma.room.update({
        where: { id: roomId },
        data: { players, status: RoomStatus.ACTIVE },
      });

      const typedRoom: Room = {
        id: updatedRoom.id,
        type: updatedRoom.type as RoomType,
        status: updatedRoom.status as RoomStatus,
        players: updatedRoom.players as { id: string; color: string | null }[],
        inviteCode: updatedRoom.inviteCode || undefined,
        createdAt: updatedRoom.createdAt,
      };

      await redis.set(`room:${roomId}`, JSON.stringify(typedRoom));
      await prisma.user.update({
        where: { id: playerId },
        data: { status: UserStatus.IN_GAME },
      });
      await redis.set(`player:${playerId}:status`, UserStatus.IN_GAME);
      this.ws.broadcastToRoom(typedRoom);

      await this.gameService.startGame(roomId);
    } catch (err) {
      this.ws.broadcastToClient(playerId, {
        type: "ERROR",
        payload: { message: (err as Error).message },
      });
      throw err;
    }
  }
}
