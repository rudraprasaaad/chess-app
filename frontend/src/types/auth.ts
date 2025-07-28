import { AuthProvider } from "./common";

export interface User {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  provider: AuthProvider;
  token?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface GuestLoginRequest {
  name: string;
}

export interface TokenPayload {
  id: string;
  provider: AuthProvider;
  iat?: number;
  exp?: number;
}

export interface AuthUserResponse {
  success: boolean;
  data: {
    id: string;
    name: string;
    email?: string;
    provider: AuthProvider;
  };
  message?: string;
}

export interface GuestUserDetails {
  id: string;
  name: string;
  token: string;
  isGuest: boolean;
}
