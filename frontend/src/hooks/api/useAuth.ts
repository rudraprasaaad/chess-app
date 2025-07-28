import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { authAPI, handleAPIError } from "../../services/api";
import { useAuthStore } from "../../store/auth";
import { useWebSocketStore } from "../../store/websocket";
import { GuestLoginRequest, GuestUserDetails, User } from "../../types/auth";
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

  return useMutation<GuestUserDetails, Error, GuestLoginRequest>({
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
      };

      setAuth(user);
      setLoading(false);

      queryClient.setQueryData(authKeys.currentUser(), user);

      connect();
    },

    onError: (error) => {
      const errorMessage = handleAPIError(error);
      setError(errorMessage);
      setLoading(false);
      toast.error(`Guest login failed: ${errorMessage}`);
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
      toast.error(`Google login failed: ${errorMessage}`);
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
      }),
      []
    ),
  });

  useEffect(() => {
    if (query.isSuccess && query.data) {
      setAuth(query.data);
      setLoading(false);
      connect();
    }

    if (query.isError) {
      console.log("No authenticated user found");
      clearAuth();
      setLoading(false);
      toast.error("Session expired, please log in again");
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

      toast.success("Session refreshed");
    },

    onError: (error) => {
      const errorMessage = handleAPIError(error);
      setError(errorMessage);
      toast.error(`Token refresh failed: ${errorMessage}`);
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

      toast.success("Logged out successfully");
    },

    onError: () => {
      toast.error("Logout failed, but you have been logged out locally");
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
