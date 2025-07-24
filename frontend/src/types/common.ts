export enum AuthProvider {
  GOOGLE = "GOOGLE",
  GUEST = "GUEST",
}

export enum UserStatus {
  OFFLINE = "OFFLINE",
  ONLINE = "ONLINE",
  WAITING = "WAITING",
  IN_GAME = "IN_GAME",
  DISCONNECTED = "DISCONNECTED",
}

export enum RoomStatus {
  OPEN = "OPEN",
  ACTIVE = "ACTIVE",
  CLOSED = "CLOSED",
}

export enum RoomType {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
}

export enum GameStatus {
  ACTIVE = "ACTIVE",
  COMPLETED = "COMPLETED",
  ABANDONED = "ABANDONED",
}
