import jwt from "jsonwebtoken";
import { Request, Response, NextFunction } from "express";
import { AuthProvider } from "../lib/types";
import { logger } from "../services/logger";
import { prisma } from "../lib/prisma";

interface JWTPayload {
  id: string;
  userId?: string;
  provider: AuthProvider;
  iat?: string;
  exp?: string;
}

const parseCookieHeader = (cookieHeader: string): Record<string, string> => {
  const cookies: Record<string, string> = {};

  cookieHeader.split(";").forEach((cookie) => {
    const [name, ...rest] = cookie.trim().split("=");
    if (name && rest.length > 0) {
      cookies[name] = decodeURIComponent(rest.join("="));
    }
  });

  return cookies;
};

const getCookieValue = (
  req: Request,
  cookieName: string
): string | undefined => {
  if (req.cookies && req.cookies[cookieName]) {
    return req.cookies[cookieName];
  }

  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const parsedCookies = parseCookieHeader(cookieHeader);
    return parsedCookies[cookieName];
  }

  return undefined;
};

export const jwtAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const guestToken = getCookieValue(req, "guest");
    const googleToken = getCookieValue(req, "google");

    const token = guestToken || googleToken;

    if (!token) return next();

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      logger.error("JWT_SECRET environment varialble is not conifgured");
      return next();
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;

    const userId = decoded.id || decoded.userId;

    if (!userId) {
      logger.warn("Invalid JWT payload - no user ID found");
      clearAuthCookies(res);
      return next();
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        provider: true,
        providerId: true,
        elo: true,
        wins: true,
        losses: true,
        draws: true,
        createdAt: true,
      },
    });

    if (!user) {
      logger.warn("JWT token valid but user not found in database", { userId });
      clearAuthCookies(res);
      return next();
    }

    req.user = user;

    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      logger.debug("JWT token has expired");
    } else if (err instanceof jwt.JsonWebTokenError) {
      logger.debug("Invalid JWT token");
    } else {
      logger.error("JWT authentication error", {
        error: err instanceof Error ? err.message : String(err),
      });
    }

    clearAuthCookies(res);
    next();
  }
};

const clearAuthCookies = (res: Response): void => {
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
};
