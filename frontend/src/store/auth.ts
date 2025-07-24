import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User } from "../types/auth";
import { AuthProvider, UserStatus } from "../types/common";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  status: UserStatus;

  setAuth: (user: User) => void;
  clearAuth: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setStatus: (status: UserStatus) => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      status: UserStatus.OFFLINE,

      setAuth: (user) => {
        set({
          user,
          isAuthenticated: true,
          error: null,
          status: UserStatus.ONLINE,
        });
      },

      clearAuth: () => {
        set({
          user: null,
          isAuthenticated: false,
          error: null,
          status: UserStatus.OFFLINE,
        });
      },

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error }),
      setStatus: (status) => set({ status }),

      updateUser: (updates) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...updates } });
        }
      },
    }),
    {
      name: "chess-auth",
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
        status: state.status,
      }),
    }
  )
);

export const useIsGuest = () =>
  useAuthStore(
    (state) => state.user !== null && state.user.provider === AuthProvider.GUEST
  );

export const useIsGoogle = () =>
  useAuthStore(
    (state) =>
      state.user !== null && state.user.provider === AuthProvider.GOOGLE
  );
