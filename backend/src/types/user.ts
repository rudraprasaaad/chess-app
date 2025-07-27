import { AuthProvider } from "@prisma/client";

export interface AppUser {
  id: string;
  name: string | null;
  username: string | null;
  email: string;
  provider: AuthProvider;
  providerId: string | null;
  password: string | null;
  elo: number;
  wins: number;
  losses: number;
  draws: number;
  isActive?: boolean;
  createdAt: Date;
  updatedAt?: Date;
}

declare global {
  namespace Express {
    interface User extends AppUser {}
  }
}
