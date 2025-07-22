
# Chess Game - Real-time Multiplayer Chess Application

A modern, real-time multiplayer chess application built with Node.js, Express, PostgreSQL, Redis, and WebSocket technology. Features comprehensive authentication, intelligent matchmaking, and seamless gameplay experience.

![Chess Game Banner](https://img.shields.io/badge/Chess-Game-blue?style=for-the-badge&logo=chess)

This chess application provides a complete multiplayer chess experience with real-time gameplay, intelligent matchmaking, and modern web technologies. Built with scalability and performance in mind, it supports thousands of concurrent players with sub-second move latency.

## ✨ Key Features

- 🔐 **Dual Authentication System** – Guest accounts & Google OAuth integration  
- ⚡ **Real-time Gameplay** – WebSocket-powered instant move synchronization  
- 🎮 **Smart Matchmaking** – Queue-based pairing with ELO rating support  
- ♟️ **Complete Chess Engine** – Full rule validation including *en passant*, castling, and promotions  
- 💬 **In-game Chat** – Real-time messaging with typing indicators  
- 🏠 **Flexible Room System** – Public rooms and private rooms with invite codes  
- 📊 **Live Statistics** – Real-time player counts and server metrics  
- 🔄 **Reconnection Handling** – Seamless game continuity after disconnections  
- 🛡️ **Anti-abuse Protection** – Rate limiting and illegal move detection  

## 🏗️ Architecture

### 🔧 Backend Stack

- **Runtime**: Node.js 18+ with TypeScript  
- **Web Framework**: Express.js with comprehensive middleware  
- **Database**: PostgreSQL with Prisma ORM  
- **Caching**: Redis for sessions and game state  
- **Real-time**: WebSocket (`ws` library) for live communication  
- **Authentication**: JWT with Passport.js for Google OAuth  
- **Validation**: Chess.js for move validation and game logic  
- **Documentation**: Swagger/OpenAPI for API documentation  

## 🗄️ Database Design

## 🚀 Quick Start

### 📦 Prerequisites

Ensure you have the following installed:

- **Node.js** ≥ 18.0  
- **PostgreSQL** ≥ 14.0  
- **Redis** ≥ 6.0  
- **pnpm** or **npm** package manager

## 🛠️ Installation

### 📥 Clone the repository

```bash
git clone https://github.com/rudraprasaaad/chess-app.git
cd chess-app
```


### 📁 Navigate to backend directory

```bash
cd backend
```

### 📦 Install dependencies

```bash
pnpm install
```

### ⚙️ Environment setup

```bash
cp .env.example .env
```

### 🧩 Configure environment variables

```env
# Database Configuration
DATABASE_URL=postgresql://username:password@localhost:5432/chess_db
REDIS_URL=redis://localhost:6379

# Authentication Secrets
JWT_SECRET=your-super-secret-jwt-key-minimum-32-characters
COOKIE_SECRET=your-cookie-secret-key-minimum-32-characters

# Google OAuth (Optional)
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# Server Configuration
PORT=4000
NODE_ENV=development
FRONTEND_URL=http://localhost:5173
AUTH_REDIRECT_URL=http://localhost:5173/game

# Session Configuration
COOKIE_MAX_AGE=604800000
```

### 🧱 Database setup

```bash
# Run database migrations
npx prisma migrate dev --name init

# Generate Prisma client
npx prisma generate
```

### 🚀 Start development server

```bash
pnpm run dev
```

## 📚 API Documentation

### 🔗 Interactive Documentation

- **Swagger UI**: [http://localhost:4000/api-docs](http://localhost:4000/api-docs)  
- **WebSocket Docs**: [http://localhost:4000/docs/websocket.md](http://localhost:4000/docs/websocket.md)

---

### 🔐 Authentication Endpoints

| Method | Endpoint                    | Description           | Authentication |
|--------|-----------------------------|-----------------------|----------------|
| POST   | `/auth/guest`               | Create guest account  | None           |
| GET    | `/auth/refresh`             | Refresh auth token    | Cookie         |
| GET    | `/auth/logout`              | Logout user           | Cookie         |
| GET    | `/auth/google`              | Google OAuth login    | None           |
| GET    | `/auth/google/callback`     | OAuth callback        | None           |

---

### 🧪 System Endpoints

| Method | Endpoint       | Description        | Response      |
|--------|----------------|--------------------|---------------|
| GET    | `/api/health`  | Server health check| Health status |

---

### 🔄 WebSocket Events

#### 📤 Client → Server

| Event Type    | Description           | Payload |
|---------------|-----------------------|---------|
| `CREATE_ROOM` | Create new game room  | `{ type: "PUBLIC" \| "PRIVATE", inviteCode?: string }` |
| `JOIN_ROOM`   | Join existing room    | `{ roomId: string, inviteCode?: string }` |
| `JOIN_QUEUE`  | Enter matchmaking     | `{ isGuest: boolean }` |
| `LEAVE_QUEUE` | Exit matchmaking      | `{}` |
| `MAKE_MOVE`   | Execute chess move    | `{ gameId: string, move: { from: string, to: string } }` |
| `CHAT_MESSAGE`| Send chat message     | `{ gameId: string, message: string }` |
| `TYPING`      | Typing indicator      | `{ gameId: string }` |

#### 📥 Server → Client

| Event Type    | Description            | When Triggered                |
|---------------|------------------------|-------------------------------|
| `ROOM_CREATED`| Room creation success  | After `CREATE_ROOM`           |
| `ROOM_UPDATED`| Room state changed     | Player joins/leaves           |
| `GAME_UPDATED`| Game state changed     | Move made, game ends          |
| `CHAT_MESSAGE`| New chat message       | Message sent                  |
| `TYPING`      | Typing indicator       | Player typing                 |
| `ERROR`       | Error occurred         | Invalid action                |
