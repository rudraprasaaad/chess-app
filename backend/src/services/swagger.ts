import swaggerJSDoc from "swagger-jsdoc";
import { Express } from "express";
import swaggerUi from "swagger-ui-express";
import { logger } from "./logger";

export class SwaggerService {
  private specs: object;

  constructor() {
    this.specs = this.generateSpecs();
  }

  private generateSpecs(): object {
    const options = {
      definition: {
        openapi: "3.0.0",
        info: {
          title: "Chess Game API",
          version: "1.0.0",
          description:
            "Real-time multiplayer chess game API with WebSocket support",
          contact: {
            name: "Chess Game API",
            email: "support@chessgame.com",
          },
          license: {
            name: "MIT",
            url: "https://opensource.org/licenses/MIT",
          },
        },
        servers: [
          {
            url: process.env.API_URL || "http://localhost:4000",
            description: "Development server",
          },
          {
            url: "https://your-production-url.com",
            description: "Production server",
          },
        ],
        components: {
          securitySchemes: {
            cookieAuth: {
              type: "apiKey",
              in: "cookie",
              name: "jwt",
              description: "JWT token stored in httpOnly cookie",
            },
            guestAuth: {
              type: "apiKey",
              in: "cookie",
              name: "guest",
              description: "Guest JWT token stored in httpOnly cookie",
            },
          },
          schemas: {
            User: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                  description: "Unique user identifier",
                },
                username: {
                  type: "string",
                  nullable: true,
                  maxLength: 50,
                  description: "Unique username",
                  example: "chess_player_123",
                },
                name: {
                  type: "string",
                  nullable: true,
                  maxLength: 100,
                  example: "John Doe",
                  description: "User display name",
                },
                email: {
                  type: "string",
                  format: "email",
                  maxLength: 255,
                  example: "player@chess.com",
                  description: "User email address",
                },
                provider: {
                  type: "string",
                  enum: ["GOOGLE", "GUEST"],
                  description: "Authentication provider used",
                },
                providerId: {
                  type: "string",
                  nullable: true,
                  maxLength: 100,
                  description: "Provider-specific user ID",
                },
                elo: {
                  type: "integer",
                  minimum: 0,
                  default: 1500,
                  description: "Player ELO rating for matchmaking",
                },
                wins: {
                  type: "integer",
                  minimum: 0,
                  default: 0,
                  description: "Total number of wins",
                },
                losses: {
                  type: "integer",
                  minimum: 0,
                  default: 0,
                  description: "Total number of losses",
                },
                draws: {
                  type: "integer",
                  minimum: 0,
                  default: 0,
                  description: "Total number of draws",
                },
                status: {
                  type: "string",
                  enum: [
                    "ONLINE",
                    "OFFLINE",
                    "WAITING",
                    "IN_GAME",
                    "DISCONNECTED",
                  ],
                  default: "OFFLINE",
                  description: "Current user status",
                },
                banned: {
                  type: "boolean",
                  default: false,
                  description: "Whether user is banned from playing",
                },
                createdAt: {
                  type: "string",
                  format: "date-time",
                  description: "Account creation timestamp",
                },
              },
              required: ["id", "email", "provider"],
            },
            Room: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                  description: "Unique room identifier",
                },
                type: {
                  type: "string",
                  enum: ["PUBLIC", "PRIVATE"],
                  description: "Room accessibility type",
                },
                status: {
                  type: "string",
                  enum: ["OPEN", "ACTIVE", "CLOSED"],
                  description: "Current room status",
                },
                players: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: {
                        type: "string",
                        format: "uuid",
                        description: "Player user ID",
                      },
                      color: {
                        type: "string",
                        enum: ["white", "black"],
                        nullable: true,
                        description: "Assigned piece color",
                      },
                    },
                    required: ["id"],
                  },
                  maxItems: 2,
                  description: "Players in the room with their assigned colors",
                },
                inviteCode: {
                  type: "string",
                  nullable: true,
                  maxLength: 20,
                  example: "CHESS123",
                  description: "Invite code for private rooms",
                },
                createdAt: {
                  type: "string",
                  format: "date-time",
                  description: "Room creation timestamp",
                },
                updatedAt: {
                  type: "string",
                  format: "date-time",
                  description: "Last room update timestamp",
                },
              },
              required: [
                "id",
                "type",
                "status",
                "players",
                "createdAt",
                "updatedAt",
              ],
            },
            Game: {
              type: "object",
              properties: {
                id: {
                  type: "string",
                  format: "uuid",
                  description: "Unique game identifier",
                },
                roomId: {
                  type: "string",
                  format: "uuid",
                  description: "Associated room ID",
                },
                fen: {
                  type: "string",
                  example:
                    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
                  description: "Current chess position in FEN notation",
                },
                moveHistory: {
                  type: "array",
                  items: {
                    type: "object",
                    description: "Chess move in various formats",
                    example: {
                      from: "e2",
                      to: "e4",
                      san: "e4",
                      piece: "p",
                      captured: null,
                      promotion: null,
                    },
                  },
                  description: "Complete move history as JSON objects",
                },
                timers: {
                  type: "object",
                  description: "Player time controls as JSON",
                  example: {
                    white: 600,
                    black: 590,
                  },
                  properties: {
                    white: {
                      type: "integer",
                      description: "White player remaining time in seconds",
                    },
                    black: {
                      type: "integer",
                      description: "Black player remaining time in seconds",
                    },
                  },
                },
                status: {
                  type: "string",
                  enum: ["ACTIVE", "COMPLETED", "ABANDONED"],
                  default: "ACTIVE",
                  description: "Current game status",
                },
                winnerId: {
                  type: "string",
                  format: "uuid",
                  nullable: true,
                  description:
                    "Winner user ID (null for draws or active games)",
                },
                createdAt: {
                  type: "string",
                  format: "date-time",
                  description: "Game creation timestamp",
                },
                updatedAt: {
                  type: "string",
                  format: "date-time",
                  description: "Last game update timestamp",
                },
                endedAt: {
                  type: "string",
                  format: "date-time",
                  nullable: true,
                  description: "Game completion timestamp",
                },
              },
              required: [
                "id",
                "roomId",
                "fen",
                "moveHistory",
                "timers",
                "status",
                "createdAt",
                "updatedAt",
              ],
            },
            Error: {
              type: "object",
              properties: {
                success: {
                  type: "boolean",
                  example: false,
                },
                message: {
                  type: "string",
                  example: "Error description",
                },
                error: {
                  type: "string",
                  example: "Technical error details",
                },
              },
              required: ["success", "message"],
            },
            SuccessResponse: {
              type: "object",
              properties: {
                success: {
                  type: "boolean",
                  example: true,
                },
                data: {
                  type: "object",
                  description: "Response payload",
                },
                message: {
                  type: "string",
                  example: "Operation successful",
                },
              },
              required: ["success"],
            },
            HealthStatus: {
              type: "object",
              properties: {
                status: {
                  type: "string",
                  example: "ok",
                  description: "Overall system health",
                },
                timestamp: {
                  type: "string",
                  format: "date-time",
                  description: "Health check timestamp",
                },
                uptime: {
                  type: "number",
                  example: 12345.67,
                  description: "Server uptime in seconds",
                },
                environment: {
                  type: "string",
                  example: "development",
                  description: "Current deployment environment",
                },
                services: {
                  type: "object",
                  properties: {
                    database: {
                      type: "string",
                      example: "connected",
                      description: "PostgreSQL connection status",
                    },
                    redis: {
                      type: "string",
                      example: "connected",
                      description: "Redis connection status",
                    },
                    websocket: {
                      type: "string",
                      example: "active",
                      description: "WebSocket server status",
                    },
                  },
                  required: ["database", "redis", "websocket"],
                },
              },
              required: [
                "status",
                "timestamp",
                "uptime",
                "environment",
                "services",
              ],
            },
          },
        },
      },
      apis: ["./src/routes/*.ts", "./src/index.ts"],
    };

    return swaggerJSDoc(options);
  }

  public setupSwagger(app: any): void {
    try {
      const expressApp = app as Express;

      expressApp.use(
        "/api-docs",
        swaggerUi.serve,
        swaggerUi.setup(this.specs, {
          explorer: true,
          customSiteTitle: "Chess Game API Documentation",
          customCss: this.getCustomCSS(),
          swaggerOptions: {
            persistAuthorization: true,
            displayRequestDuration: true,
            filter: true,
            showExtensions: true,
            showCommonExtensions: true,
            tagsSorter: "alpha",
            operationsSorter: "alpha",
          },
        })
      );

      logger.info("📖 Swagger documentation initialized at /api-docs");
    } catch (error) {
      logger.error("Failed to setup Swagger documentation:", error);
      throw error;
    }
  }

  private getCustomCSS(): string {
    return `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info .title { color: #3b82f6; font-size: 2rem; }
      .swagger-ui .info .description { color: #6b7280; font-size: 1.1rem; }
      .swagger-ui .scheme-container { background: #f8fafc; padding: 15px; border-radius: 8px; margin: 10px 0; }
      .swagger-ui .opblock .opblock-summary-path { font-weight: 600; }
      .swagger-ui .opblock.opblock-post { border-color: #10b981; }
      .swagger-ui .opblock.opblock-get { border-color: #3b82f6; }
      .swagger-ui .opblock.opblock-put { border-color: #f59e0b; }
      .swagger-ui .opblock.opblock-delete { border-color: #ef4444; }
    `;
  }

  public getSpecs(): object {
    return this.specs;
  }

  public isEnabled(): boolean {
    return (
      process.env.NODE_ENV !== "production" ||
      process.env.ENABLE_DOCS === "true"
    );
  }
}

export const swagger = new SwaggerService();
