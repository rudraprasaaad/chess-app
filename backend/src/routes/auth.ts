import { Request, Response, Router } from "express";
import passport from "passport";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { COOKIE_MAX_AGE } from "../lib/consts";
import { prisma } from "../lib/prisma";
import { logger } from "../services/logger";
import { AuthProvider } from "../lib/types";

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

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication and session management endpoints
 */

/**
 * @swagger
 * /auth/guest:
 *   post:
 *     summary: Create a guest user account
 *     tags: [Authentication]
 *     description: Creates a temporary guest account for playing chess without registration. Perfect for quick games without signup process. Guest accounts are automatically cleaned up after expiration.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 description: Display name for the guest user (optional)
 *                 example: "ChessPlayer123"
 *                 minLength: 1
 *                 maxLength: 50
 *           examples:
 *             with_name:
 *               summary: Guest with custom name
 *               value:
 *                 name: "PlayerABC"
 *             without_name:
 *               summary: Guest with auto-generated name
 *               value: {}
 *             empty_body:
 *               summary: No request body
 *               value: null
 *     responses:
 *       201:
 *         description: Guest user created successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                           description: Generated user ID
 *                           example: "550e8400-e29b-41d4-a716-446655440000"
 *                         name:
 *                           type: string
 *                           description: Guest display name
 *                           example: "guest-abc123"
 *                         token:
 *                           type: string
 *                           description: JWT authentication token
 *                           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *                         isGuest:
 *                           type: boolean
 *                           example: true
 *                           description: Indicates this is a guest account
 *                     message:
 *                       type: string
 *                       example: "Guest created successfully"
 *         headers:
 *           Set-Cookie:
 *             description: Guest authentication cookie (httpOnly, secure)
 *             schema:
 *               type: string
 *               example: "guest=jwt_token_here; HttpOnly; Path=/; Max-Age=604800"
 *       400:
 *         description: Invalid request data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               invalid_name:
 *                 summary: Name too long
 *                 value:
 *                   success: false
 *                   message: "Name must be between 1 and 50 characters"
 *       500:
 *         description: Server error during user creation
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               server_error:
 *                 summary: Internal server error
 *                 value:
 *                   success: false
 *                   message: "Failed to create guest user"
 */
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

/**
 * @swagger
 * /auth/refresh:
 *   get:
 *     summary: Refresh authentication token
 *     tags: [Authentication]
 *     description: Refreshes the user's authentication token and returns updated user information. Works for both Google OAuth users and guest users by reading from their respective cookies.
 *     security:
 *       - cookieAuth: []
 *       - guestAuth: []
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       oneOf:
 *                         - type: object
 *                           description: Google OAuth user data
 *                           properties:
 *                             id:
 *                               type: string
 *                               format: uuid
 *                             name:
 *                               type: string
 *                               example: "John Doe"
 *                             token:
 *                               type: string
 *                               description: New JWT authentication token
 *                             isGuest:
 *                               type: boolean
 *                               example: false
 *                         - type: object
 *                           description: Guest user data
 *                           properties:
 *                             id:
 *                               type: string
 *                               format: uuid
 *                             name:
 *                               type: string
 *                               example: "guest-abc123"
 *                             token:
 *                               type: string
 *                               description: New JWT authentication token
 *                             isGuest:
 *                               type: boolean
 *                               example: true
 *         headers:
 *           Set-Cookie:
 *             description: Updated authentication cookie
 *             schema:
 *               type: string
 *       401:
 *         description: Invalid or missing authentication
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               unauthorized:
 *                 summary: No valid authentication found
 *                 value:
 *                   success: false
 *                   message: "Unauthorized"
 *       404:
 *         description: User not found in database
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               user_not_found:
 *                 summary: User account deleted or invalid
 *                 value:
 *                   success: false
 *                   message: "User not found"
 *       500:
 *         description: Server error during token refresh
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               server_error:
 *                 summary: Internal server error
 *                 value:
 *                   success: false
 *                   message: "Failed to refresh token"
 */
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

/**
 * @swagger
 * /auth/logout:
 *   get:
 *     summary: Log out current user
 *     tags: [Authentication]
 *     description: Logs out the current user by clearing authentication cookies and ending the session. Works for both guest and Google OAuth users. Redirects to frontend after successful logout.
 *     security:
 *       - cookieAuth: []
 *       - guestAuth: []
 *     responses:
 *       200:
 *         description: Logout successful, redirects to frontend
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/SuccessResponse'
 *                 - type: object
 *                   properties:
 *                     message:
 *                       type: string
 *                       example: "Logged out successfully"
 *         headers:
 *           Set-Cookie:
 *             description: Cleared authentication cookies
 *             schema:
 *               type: array
 *               items:
 *                 type: string
 *               example: ["guest=; Max-Age=0", "google=; Max-Age=0"]
 *           Location:
 *             description: Redirect URL to frontend
 *             schema:
 *               type: string
 *               example: "http://localhost:5173"
 *       500:
 *         description: Logout processing error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               logout_error:
 *                 summary: Session cleanup failed
 *                 value:
 *                   success: false
 *                   error: "Failed to log out"
 */
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

/**
 * @swagger
 * /auth/google:
 *   get:
 *     summary: Initiate Google OAuth authentication
 *     tags: [Authentication]
 *     description: Redirects user to Google OAuth consent screen for authentication. User will be prompted to grant permissions for profile and email access.
 *     responses:
 *       302:
 *         description: Redirect to Google OAuth authorization URL
 *         headers:
 *           Location:
 *             description: Google OAuth authorization URL with required parameters
 *             schema:
 *               type: string
 *               example: "https://accounts.google.com/oauth/authorize?response_type=code&client_id=your_client_id&redirect_uri=callback_url&scope=profile%20email"
 *       500:
 *         description: OAuth configuration error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

/**
 * @swagger
 * /auth/google/callback:
 *   get:
 *     summary: Handle Google OAuth callback
 *     tags: [Authentication]
 *     description: Processes the OAuth callback from Google, creates or updates user account, and redirects to the frontend application. Handles both successful authentication and various error scenarios.
 *     parameters:
 *       - in: query
 *         name: code
 *         required: true
 *         schema:
 *           type: string
 *         description: Authorization code from Google OAuth
 *         example: "4/0AX4XfWjE2Z1..."
 *       - in: query
 *         name: state
 *         schema:
 *           type: string
 *         description: Optional state parameter for CSRF protection
 *       - in: query
 *         name: error
 *         schema:
 *           type: string
 *         description: Error parameter if OAuth failed
 *         example: "access_denied"
 *     responses:
 *       302:
 *         description: Redirect response - authentication result
 *         content:
 *           text/html:
 *             schema:
 *               type: string
 *               description: HTML redirect response
 *         headers:
 *           Location:
 *             description: Redirect URL based on authentication result
 *             schema:
 *               oneOf:
 *                 - type: string
 *                   description: Success - Frontend application URL
 *                   example: "http://localhost:5173/game"
 *                 - type: string
 *                   description: Auth failure - Login failed page
 *                   example: "/login/failed"
 *                 - type: string
 *                   description: Processing error - Frontend with error parameter
 *                   example: "http://localhost:5173/login?error=callback_failed"
 *           Set-Cookie:
 *             description: JWT authentication cookie (only set on successful authentication)
 *             schema:
 *               type: string
 *               example: "google=jwt_token; HttpOnly; Path=/; Max-Age=604800"
 */
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
