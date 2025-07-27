import { Request, Response, Router } from "express";
import passport from "passport";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { COOKIE_MAX_AGE } from "../lib/consts";
import { prisma } from "../lib/prisma";
import { logger } from "../services/logger";
import { AuthProvider } from "../lib/types";
import "../types/express";

const router = Router();

interface UserDetails {
  id: string;
  token?: string;
  name: string;
  isGuest?: boolean;
}

interface AuthenticatedUser {
  id: string;
  name: string;
  email?: string;
  provider: AuthProvider;
}

router.get("/me", (req: Request, res: Response) => {
  try {
    if (!req.user) {
      console.log(req.user);
      return res.status(401).json({
        success: false,
        message: "Not Authenticated",
      });
    }

    const user = req.user as AuthenticatedUser;

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        provider: user.provider,
      },
    });
  } catch (err) {
    logger.error("Error in /auth/me:", err);
    res.status(401).json({
      success: false,
      message: "Unauthenticated",
    });
  }
});

router.post("/guest", async (req: Request, res: Response) => {
  try {
    const bodyData = req.body;
    const guestUUID = `guest-${uuidv4()}`;

    const user = await prisma.user.create({
      data: {
        username: guestUUID,
        email: `${guestUUID}@chess.com`,
        name: bodyData.name || guestUUID,
        provider: AuthProvider.GUEST,
      },
    });

    const token = jwt.sign(
      { id: user.id, provider: "GUEST" },
      process.env.JWT_SECRET!,
      { expiresIn: "24h" }
    );

    logger.info(`Guest created successfully: ${user.id}`);

    const UserDetails: UserDetails = {
      id: user.id,
      name: user.name!,
      token,
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
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const user = req.user;

    // Determine token type based on user provider
    const isGuest = user.provider === AuthProvider.GUEST;
    const cookieName = isGuest ? "guest" : "google";

    const token = jwt.sign(
      { id: user.id, provider: user.provider },
      process.env.JWT_SECRET!,
      { expiresIn: "24h" }
    );

    // Set the appropriate cookie
    res.cookie(cookieName, token, {
      httpOnly: true,
      maxAge: COOKIE_MAX_AGE,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    });

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name || user.username,
        token,
        isGuest,
      },
    });
  } catch (error) {
    logger.error("Error refreshing token:", error);
    res.status(500).json({
      success: false,
      message: "Failed to refresh token",
    });
  }
});

router.post("/logout", (req: Request, res: Response) => {
  try {
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite:
        process.env.NODE_ENV === "production"
          ? ("none" as const)
          : ("lax" as const),
    };

    res.clearCookie("guest", cookieOptions);
    res.clearCookie("google", cookieOptions);

    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          logger.error("Session destruction error:", err);
        }
      });
    }

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    logger.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
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
        { id: user.id, provider: "GOOGLE" },
        process.env.JWT_SECRET!,
        { expiresIn: "24h" }
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
  })(req, res, next);
});

export default router;
