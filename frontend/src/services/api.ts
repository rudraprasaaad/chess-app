/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosResponse } from "axios";
import { toast } from "sonner";
import type {
  User,
  GuestLoginRequest,
  AuthUserResponse,
  GuestUserDetails,
} from "../types/auth";
import { useAuthStore } from "../store/auth";
import { AuthProvider } from "../types/common";

const apiUrl = import.meta.env.PROD
  ? import.meta.env.VITE_API_URL
  : import.meta.env.VITE_API_URL_DEV;

export const api = axios.create({
  baseURL: apiUrl,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10000,
});

api.interceptors.request.use(
  (config) => {
    if (import.meta.env.NODE_ENV === "development") {
      console.log(`API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    return config;
  },
  (error) => {
    console.error("API Request Error:", error);
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response: AxiosResponse) => {
    if (import.meta.env.NODE_ENV === "development") {
      console.log(`API Response: ${response.status} ${response.config.url}`);
    }
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();

      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
      toast.error("Session expired. Please log in again.");
    }

    if (!error.response) {
      toast.error("Network error. Please check your connection.");
      error.message = "Network error. Please check your connection.";
    }

    if (import.meta.env.NODE_ENV === "development") {
      console.error("API Error:", {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
        url: error.config?.url,
      });
    }

    return Promise.reject(error);
  }
);

export const authAPI = {
  guestLogin: async (data: GuestLoginRequest): Promise<GuestUserDetails> => {
    const response = await api.post<{
      success: boolean;
      data: GuestUserDetails;
      message: string;
    }>("/auth/guest", data);

    return response.data.data;
  },

  googleLogin: (): void => {
    const googleAuthUrl = `${api.defaults.baseURL}/auth/google`;
    window.location.href = googleAuthUrl;
  },

  getCurrentUser: async (): Promise<User> => {
    const response = await api.get<AuthUserResponse>("/auth/me");

    if (!response.data.success) {
      throw new Error(response.data.message || "Failed to get user");
    }

    return {
      id: response.data.data.id,
      name: response.data.data.name,
      email: response.data.data.email,
      provider: response.data.data.provider,
    };
  },

  refreshToken: async (): Promise<{
    user: User;
    token: string;
    isGuest: boolean;
  }> => {
    const response = await api.get<{
      success: boolean;
      data: {
        id: string;
        name: string;
        token: string;
        isGuest: boolean;
      };
    }>("/auth/refresh");

    if (!response.data.success) {
      throw new Error("Failed to refresh token");
    }

    const userData = response.data.data;

    return {
      user: {
        id: userData.id,
        name: userData.name,
        provider: userData.isGuest ? AuthProvider.GUEST : AuthProvider.GOOGLE,
      },
      token: userData.token,
      isGuest: userData.isGuest,
    };
  },

  logout: async (): Promise<void> => {
    await api.post<{
      success: boolean;
      message: string;
    }>("/auth/logout");
  },
};

export const userAPI = {
  getUserProfile: async (userId: string): Promise<User> => {
    const response = await api.get<{
      success: boolean;
      data: User;
    }>(`/users/${userId}`);

    return response.data.data;
  },

  updateProfile: async (
    updates: Partial<Pick<User, "name" | "avatarUrl">>
  ): Promise<User> => {
    const response = await api.patch<{
      success: boolean;
      data: User;
    }>("/users/me", updates);

    return response.data.data;
  },
};

export const gameAPI = {
  getGameHistory: async (limit: number = 10): Promise<any[]> => {
    const response = await api.get<{
      success: boolean;
      data: any[];
    }>(`/games/history?limit=${limit}`);

    return response.data.data;
  },

  getGameDetails: async (gameId: string): Promise<any> => {
    const response = await api.get<{
      success: boolean;
      data: any;
    }>(`/games/${gameId}`);

    return response.data.data;
  },
  getUserStats: async (): Promise<{
    gamesPlayed: number;
    wins: number;
    losses: number;
    draws: number;
    winRate: number;
    averageGameTime: number;
  }> => {
    const response = await api.get<{
      success: boolean;
      data: any;
    }>("/games/stats");

    return response.data.data;
  },
};

export const roomAPI = {
  getRoomId: async (inviteCode: string): Promise<any> => {
    const response = await api.get<{
      success: boolean;
      message: string;
      data: any;
    }>(`/room/lookup?inviteCode=${inviteCode}`);

    return response.data.data;
  },
};

export const handleAPIError = (error: any): string => {
  if (error.response?.data?.message) {
    toast.error(error.response.data.message);
    return error.response.data.message;
  }

  if (error.message) {
    toast.error(error.message);
    return error.message;
  }
  toast.error("An unexpected error occurred");
  return "An unexpected error occurred";
};

export const checkAPIHealth = async (): Promise<boolean> => {
  try {
    const response = await api.get("/health");
    return response.status === 200;
  } catch (error) {
    console.error("API Health Check Failed:", error);
    return false;
  }
};

export const withRetry = async <T>(
  apiCall: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> => {
  let lastError: any;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await apiCall();
    } catch (error: any) {
      lastError = error;

      if (error.response?.status === 401 || error.response?.status === 403) {
        throw error;
      }
      if (attempt === maxRetries) {
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, delay * attempt));
      console.log(`API call failed, retrying... (${attempt}/${maxRetries})`);
    }
  }

  throw lastError;
};

export default api;
