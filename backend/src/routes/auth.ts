import { Request, Response, Router } from "express";
import { PrismaClient } from "../generated/prisma";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { LoggerService } from "../services/logger";
import { COOKIE_MAX_AGE } from "../lib/consts";

const router = Router();
const prisma = new PrismaClient();
const logger = new LoggerService();

interface userJwtClaims {
  userId: string;
  name: string;
  isGuest?: boolean;
}

interface UserDetails {
  id: string;
  token?: string;
  name: string;
  isGuest?: boolean;
}

router.post("/guest", async (req: Request, res: Response) => {
  const bodyData = req.body;
  let guestUUID = "guest-" + uuidv4();

  const user = await prisma.user.create({
    data: {
      username: guestUUID,
      email: guestUUID + "@chess.com",
      name: bodyData.name || guestUUID,
      provider: "GUEST",
    },
  });

  const token = jwt.sign(
    { userId: user.id, name: user.name, isGuest: true },
    process.env.JWT_SECRET!
  );

  logger.info(`Guest created successfully: ${user.id}`);

  const UserDetails: UserDetails = {
    id: user.id,
    name: user.name!,
    token: token,
    isGuest: true,
  };

  res.cookie("guest", token, { maxAge: COOKIE_MAX_AGE });
  res.status(201).json({
    success: true,
    data: UserDetails,
    message: "Guest created successfully",
  });
});

export default router;
