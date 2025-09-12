# ♟️ Chess Game – Multiplayer Chess, Rebuilt for 2025  

Because chess shouldn’t feel like a relic from 2005. This is **real-time multiplayer chess** built like a modern startup product — fast, scalable, and ridiculously smooth.  

![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/redis-%23DD0031.svg?&style=for-the-badge&logo=redis&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=for-the-badge&logo=tailwind-css&logoColor=white)

Built with a **React frontend** and a **Node.js backend**, this app scales to thousands of players while keeping move latency under a second. Add Redis, WebSockets, and some startup-grade design flair — you’ve got chess reimagined.  

---

## ✨ Key Features  

- 🔐 **Login Like a Pro** – Guests jump in instantly, power users get Google OAuth. No friction, just play.  
- ⚡ **Moves in Milliseconds** – WebSockets keep your board synced in real time. You move, they see. Instantly.  
- 🎨 **UI That *Feels* Alive** – Tailwind + Framer Motion. Smooth, animated, responsive. Looks good everywhere.  
- 🧠 **Matchmaking on Steroids** – Redis queues + ELO logic. Always land players at your skill level.  
- 🤖 **Play vs Bot** – Don’t feel social? Warm up against the computer before you crush real opponents.  
- ♟️ **Full-Fledged Chess Brain** – En passant, castling, promotions—powered by Chess.js. No shortcuts.  
- 💬 **Trash Talk Ready** – Real-time chat with typing indicators. “gg” or talk smack, your call.  
- 🏠 **Rooms That Work for You** – Quick public games or invite-only private lobbies. Flexibility built-in.  
- 🔄 **Disconnect-Proof** – WiFi dropped? No sweat. Reconnect and pick up right where you left off.  
- 🛡️ **Fair Play Only** – Rate limiting, illegal move detection, anti-spam. No cheaters, no nonsense.  

---

## 🚀 Tech Stack  

### 🎨 Frontend  

- **Framework**: React.js 18+ with Vite (fast dev, instant HMR)  
- **Styling**: Tailwind CSS + Radix UI (accessible, modern components)  
- **State Management**: Zustand (lightweight, no boilerplate)  
- **Data Layer**: TanStack Query (React Query) for server state & caching  
- **Animations**: Framer Motion for smooth transitions  
- **Real-time Client**: Native WebSocket API  

### ⚡ Backend  

- **Core**: Node.js 18+ with TypeScript  
- **Framework**: Express.js with custom middleware  
- **Database**: PostgreSQL + Prisma ORM (type-safe, reliable)  
- **Caching & Queues**: Redis for matchmaking, sessions & active game state  
- **Real-time Server**: `ws` library powering WebSocket communication  
- **Auth**: JWT + Passport.js (Google OAuth strategy)  
- **Game Logic**: Chess.js (robust, battle-tested move validation)  

---

## 🏁 Why This Exists  

Most chess apps feel like they were built a decade ago.  
This one feels like it belongs on your 2025 home screen: **fast, social, beautiful, and scalable**.  

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