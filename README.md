# Chess Game - Real-time Multiplayer Chess Application

A modern, full-stack, real-time multiplayer chess application built with a powerful combination of Node.js, React, PostgreSQL, and WebSocket technology. It features a comprehensive authentication system, intelligent matchmaking, and a seamless, responsive gameplay experience.

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?&style=for-the-badge&logo=redis&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

This chess application provides a complete multiplayer experience, designed from the ground up for performance and scalability. The responsive frontend built with React and the robust Node.js backend support thousands of concurrent players with sub-second move latency.

## ✨ Key Features

-   🔐 **Dual Authentication System** – Secure session-based access for guests & Google OAuth integration.
-   ⚡ **Seamless Real-time Gameplay** – WebSocket-powered instant move synchronization for a fluid experience.
-   🎨 **Responsive & Animated UI** – Modern interface built with Tailwind CSS and Framer Motion that works flawlessly on all devices.
-   🧠 **Smart Matchmaking** – **Redis-powered queues** for pairing players based on ELO rating.
-   ♟️ **Complete Chess Engine** – Full rule validation including *en passant*, castling, and promotions via Chess.js.
-   💬 **In-Game Chat** – Real-time messaging between players with typing indicators.
-   🏠 **Flexible Room System** – Public rooms for quick matches and private, invite-only rooms for friends.
-   🔄 **Robust Reconnection Handling** – Seamless game continuity after network disconnections.
-   🛡️ **Anti-abuse Protection** – Backend rate limiting and illegal move detection to ensure fair play.

## 🚀 Tech Stack

### Frontend

-   **Core Framework**: **React.js 18+** with Vite
-   **Styling**: **Tailwind CSS** with Radix UI for accessible components
-   **State Management**: **Zustand** for simple, centralized global state
-   **Data Fetching & Caching**: **TanStack Query (React Query)** for server state management
-   **Animations**: **Framer Motion** for fluid UI transitions and animations
-   **Real-time Client**: Native WebSocket API for live communication

### Backend

-   **Core**: **Node.js 18+** with TypeScript
-   **API Framework**: **Express.js** with comprehensive middleware
-   **Database**: **PostgreSQL** with **Prisma ORM** for type-safe database access
-   **In-Memory Caching & Queues**: **Redis** for high-performance caching of active game state, session management, and powering the real-time matchmaking queues.
-   **Real-time Server**: **`ws` library** for a high-performance WebSocket server
-   **Authentication**: **JWT** with **Passport.js** for Google OAuth strategy
-   **Game Logic**: **Chess.js** for robust move validation

## 📊 System Design Diagrams

### Entity Relationship Diagram


```mermaid
erDiagram
    User ||--o{ GamePlayer : has
    Game ||--o{ GamePlayer : includes
    Game ||--o{ Room : belongs_to
    Room ||--o{ Game : contains

    User {
        string id PK
        string username
        string name
        string email
        enum provider
        string providerId
        string password
        int elo
        int wins
        int losses
        int draws
        enum status
        boolean banned
        datetime createdAt
    }

    Game {
        string id PK
        string roomId FK
        string fen
        json[] moveHistory
        json timers
        enum status
        json[] chat
        string winnerId
        datetime createdAt
        datetime updatedAt
        datetime endedAt
        string userId
    }

    Room {
        string id PK
        enum type
        enum status
        json[] players
        string inviteCode
        datetime createdAt
        datetime updatedAt
    }

    GamePlayer {
        string gameId FK
        string userId FK
        string color
    }
```

### 🧭 Class Diagram (OOP Perspective)

```mermaid
classDiagram
    class User {
        +String id
        +String username
        +String name
        +String email
        +AuthProvider provider
        +String providerId
        +String password
        +Int elo
        +Int wins
        +Int losses
        +Int draws
        +UserStatus status
        +Boolean banned
        +DateTime createdAt
    }

    class Game {
        +String id
        +String roomId
        +String fen
        +Json[] moveHistory
        +Json timers
        +GameStatus status
        +Json[] chat
        +String winnerId
        +DateTime createdAt
        +DateTime updatedAt
        +DateTime endedAt
        +String userId
    }

    class Room {
        +String id
        +RoomType type
        +RoomStatus status
        +Json[] players
        +String inviteCode
        +DateTime createdAt
        +DateTime updatedAt
    }

    class GamePlayer {
        +String gameId
        +String userId
        +String color
    }

    User "1" --> "*" GamePlayer : plays
    Game "1" --> "*" GamePlayer : includes
    Room "1" --> "*" Game : contains
    Game "1" --> "1" Room : uses
```