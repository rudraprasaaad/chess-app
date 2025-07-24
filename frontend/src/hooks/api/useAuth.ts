import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useEffect } from "react";
import { authAPI, handleAPIError } from "../../services/api";
import { useAuthStore } from "../../store/auth";
import { useWebSocketStore } from "../../store/websocket";
import { GuestLoginRequest, User } from "../../types/auth";
import { AuthProvider, UserStatus } from "../../types/common";

export const authKeys = {
  all: ["auth"] as const,
  currentUser: () => [...authKeys.all, "currentUser"] as const,
  refresh: () => [...authKeys.all, "refresh"] as const,
};

export function useGuestLogin() {
  const queryClient = useQueryClient();
  const { setAuth, setLoading, setError } = useAuthStore();
  const { connect } = useWebSocketStore();

  return useMutation({
    mutationFn: (data: GuestLoginRequest) => authAPI.guestLogin(data),

    onMutate: () => {
      setLoading(true);
      setError(null);
    },

    onSuccess: (guestData) => {
      const user: User = {
        id: guestData.id,
        name: guestData.name,
        provider: AuthProvider.GUEST,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setAuth(user);
      setLoading(false);

      queryClient.setQueryData(authKeys.currentUser(), user);

      connect();

      console.log("Guest login successful:", guestData.name);
    },

    onError: (error) => {
      const errorMessage = handleAPIError(error);
      setError(errorMessage);
      setLoading(false);
      console.error("Guest login failed:", errorMessage);
    },
  });
}

export function useGoogleLogin() {
  const { setLoading, setError } = useAuthStore();

  return useMutation({
    mutationFn: () => {
      setLoading(true);
      setError(null);
      authAPI.googleLogin();
      return Promise.resolve();
    },

    onError: (error) => {
      const errorMessage = handleAPIError(error);
      setError(errorMessage);
      setLoading(false);
    },
  });
}

export function useCurrentUser() {
  const { setAuth, clearAuth, setLoading } = useAuthStore();
  const { connect } = useWebSocketStore();

  const query = useQuery({
    queryKey: authKeys.currentUser(),
    queryFn: authAPI.getCurrentUser,

    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    retry: 1,
    refetchOnWindowFocus: false,

    select: useCallback(
      (data: User) => ({
        id: data.id,
        name: data.name,
        email: data.email,
        provider: data.provider,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      }),
      []
    ),
  });

  useEffect(() => {
    if (query.isSuccess && query.data) {
      setAuth(query.data);
      setLoading(false);
      connect();
      console.log("Current user loaded:", query.data.name);
    }

    if (query.isError) {
      console.log("No authenticated user found");
      clearAuth();
      setLoading(false);
    }
  }, [
    query.isSuccess,
    query.isError,
    query.data,
    setAuth,
    clearAuth,
    setLoading,
    connect,
  ]);

  return query;
}

export function useRefreshToken() {
  const queryClient = useQueryClient();
  const { setAuth, setError } = useAuthStore();

  return useMutation({
    mutationFn: authAPI.refreshToken,

    onSuccess: (data) => {
      setAuth(data.user);

      queryClient.setQueryData(authKeys.currentUser(), data.user);

      console.log("Token refreshed successfully");
    },

    onError: (error) => {
      const errorMessage = handleAPIError(error);
      setError(errorMessage);
      console.error("Token refresh failed:", errorMessage);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  const { clearAuth } = useAuthStore();
  const { disconnect } = useWebSocketStore();

  return useMutation({
    mutationFn: authAPI.logout,

    onMutate: () => {
      clearAuth();
      disconnect();
    },

    onSuccess: () => {
      queryClient.clear();

      useAuthStore.getState().setStatus(UserStatus.OFFLINE);

      console.log("Logout successful");
    },

    onError: () => {
      console.log("Logout completed (API call failed but local state cleared)");
      queryClient.clear();
    },

    onSettled: () => {
      if (window.location.pathname !== "/") {
        window.location.href = "/";
      }
    },
  });
}

export function useAuthStatus() {
  const authState = useAuthStore((state) => ({
    user: state.user,
    isAuthenticated: state.isAuthenticated,
    isLoading: state.isLoading,
    error: state.error,
  }));

  return useMemo(
    () => ({
      ...authState,
      isGuest: authState.user?.provider === AuthProvider.GUEST,
      isGoogle: authState.user?.provider === AuthProvider.GOOGLE,
    }),
    [authState]
  );
}

export function useInitializeAuth() {
  const { isAuthenticated } = useAuthStore();
  const currentUserQuery = useCurrentUser();

  const shouldFetch = !isAuthenticated;

  return {
    isInitializing: shouldFetch && currentUserQuery.isLoading,
    initializationComplete: isAuthenticated || currentUserQuery.isError,
    error: currentUserQuery.error,
  };
}

export const useIsAuthenticated = () =>
  useAuthStore((state) => state.isAuthenticated);
export const useUserName = () =>
  useAuthStore((state) => state.user?.name || "Anonymous");
export const useIsGuest = () =>
  useAuthStore((state) => state.user?.provider === AuthProvider.GUEST);
export const useIsGoogle = () =>
  useAuthStore((state) => state.user?.provider === AuthProvider.GOOGLE);

export const useUserInfo = () =>
  useAuthStore((state) => ({
    user: state.user,
    userName: state.user?.name || "Anonymous",
    isGuest: state.user?.provider === AuthProvider.GUEST,
    isGoogle: state.user?.provider === AuthProvider.GOOGLE,
  }));
