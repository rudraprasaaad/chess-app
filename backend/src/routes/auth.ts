import { Request, Response, Router } from "express";
import { PrismaClient } from "../generated/prisma";
import passport from "passport";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { LoggerService } from "../services/logger";
import { COOKIE_MAX_AGE } from "../lib/consts";
import { info } from "winston";

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

  res.cookie("guest", token, { httpOnly: true, maxAge: COOKIE_MAX_AGE });
  res.status(201).json({
    success: true,
    data: UserDetails,
    message: "Guest created successfully",
  });
});

router.get("/refresh", async (req: Request, res: Response) => {
  if (req.user) {
    const user = req.user as UserDetails;

    const userDb = await prisma.user.findFirst({
      where: {
        id: user.id,
      },
    });

    const token = jwt.sign(
      { userId: user.id, name: userDb?.name },
      process.env.JWT_SECRET!
    );
    res.json({
      token,
      id: user.id,
      name: userDb?.name,
    });
  } else if (req.cookies && req.cookies.guest) {
    const decoded = jwt.verify(
      req.cookies.guest,
      process.env.JWT_SECRET!
    ) as userJwtClaims;
    const token = jwt.sign(
      { userId: decoded.userId, name: decoded.name, isGuest: true },
      process.env.JWT_SECRET!
    );
    let User: UserDetails = {
      id: decoded.userId,
      name: decoded.name,
      token: token,
      isGuest: true,
    };
    res.cookie("guest", token, { httpOnly: true, maxAge: COOKIE_MAX_AGE });
    res.json(User);
  } else {
    res.status(401).json({ success: false, message: "Unauthorized" });
  }
});

router.get("/logout", (req: Request, res: Response) => {
  res.clearCookie("guest");

  req.logout((err: Error) => {
    if (err) {
      res.status(500).json({ error: "Failed to log out" });
    } else {
      res.clearCookie("jwt");
      res.redirect("http://localhost:5173");
    }
  });
});

router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get("/google/callback", (req, res, next) => {
  passport.authenticate("google", async (err: Error, user: UserDetails) => {
    if (err || !user) {
      return res.redirect("/login/failed");
    }

    const token = jwt.sign(
      { userId: user.id, name: user.name, isGuest: false },
      process.env.JWT_SECRET!
    );

    res.cookie("google", token, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
    });

    res.redirect(process.env.AUTH_REDIRECT_URL!);
  })(req, res, next);
});

export default router;
