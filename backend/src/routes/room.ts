import { Request, Response, Router } from "express";
import { prisma } from "../lib/prisma";
import { RoomStatus } from "../lib/types";

const router: Router = Router();

router.get(`/lookup`, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
    const inviteCode = String(req.query.inviteCode).trim() || undefined;
    if (!inviteCode) {
      return res.status(400).json({
        success: false,
        message: "Invite Code is required",
      });
    }

    const room = await prisma.room.findUnique({
      where: {
        inviteCode,
        status: RoomStatus.OPEN,
      },
      select: {
        id: true,
      },
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        message: `No room found with invite code: ${inviteCode}`,
      });
    }

    res.status(200).json({
      success: true,
      message: "Room found successfully",
      data: room,
    });
    return;
  } catch {
    res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
    return;
  }
});

export default router;
