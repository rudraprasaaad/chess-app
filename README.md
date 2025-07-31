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

## 🗄️ Database Design

### 📘 Entity Relationship Diagram

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
