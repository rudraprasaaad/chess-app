import { Request, Response, Router } from "express";
import passport from "passport";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { COOKIE_MAX_AGE } from "../lib/consts";
import { prisma } from "../lib/prisma";
import { logger } from "../services/logger";

const router = Router();

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
  try {
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
      { id: user.id, provider: "GUEST" },
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
  } catch (err) {
    logger.error("Error creating guest user:", err);
    res.status(500).json({
      success: false,
      message: "Failed to create guest user",
    });
  }
});

router.get("/refresh", async (req: Request, res: Response) => {
  try {
    if (req.user) {
      const user = req.user as UserDetails;

      const userDb = await prisma.user.findFirst({
        where: {
          id: user.id,
        },
      });

      if (!userDb) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const token = jwt.sign(
        { id: user.id, provider: "GOOGLE" },
        process.env.JWT_SECRET!
      );

      res.json({
        success: true,
        data: {
          token,
          id: user.id,
          name: userDb.name,
          isGuest: false,
        },
      });
    } else if (req.cookies && req.cookies.guest) {
      const decoded = jwt.verify(
        req.cookies.guest,
        process.env.JWT_SECRET!
      ) as userJwtClaims;

      const token = jwt.sign(
        { id: decoded.userId, provider: "GUEST" },
        process.env.JWT_SECRET!
      );

      const userDetails: UserDetails = {
        id: decoded.userId,
        name: decoded.name,
        token: token,
        isGuest: true,
      };

      res.cookie("guest", token, {
        httpOnly: true,
        maxAge: COOKIE_MAX_AGE,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
      });

      res.json({
        success: true,
        data: userDetails,
      });
    } else {
      res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }
  } catch (error) {
    logger.error("Error refreshing token:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh token",
    });
  }
});

router.get("/logout", (req: Request, res: Response) => {
  res.clearCookie("guest");
  res.clearCookie("google");

  req.logout((err: Error) => {
    if (err) {
      logger.error("Logout error:", err);
      res.status(500).json({
        success: false,
        error: "Failed to log out",
      });
    } else {
      res.json({
        success: true,
        message: "Logged out successfully",
      });
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
      logger.error("Google auth error:", err);
      return res.redirect("/login/failed");
    }

    try {
      const token = jwt.sign(
        { userId: user.id, provider: "GOOGLE" },
        process.env.JWT_SECRET!
      );

      res.cookie("google", token, {
        httpOnly: true,
        maxAge: COOKIE_MAX_AGE,
      });

      res.redirect(process.env.AUTH_REDIRECT_URL!);
    } catch (err) {
      logger.error("Error in Google callback:", err);
      res.redirect(`${process.env.FRONTEND_URL}/login?error=callback_failed`);
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
