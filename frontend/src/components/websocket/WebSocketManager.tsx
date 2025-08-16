import { memo, useCallback, useEffect } from "react";
import { useAuthStore } from "../../store/auth";
import { useWebSocketStore } from "../../store/websocket";

export const WebSocketManagerComponent = () => {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isLoading = useAuthStore((state) => state.isLoading);
  const wsStatus = useWebSocketStore((state) => state.status);
  const connect = useWebSocketStore((state) => state.connect);

  useEffect(() => {
    if (isAuthenticated && !isLoading && wsStatus === "disconnected") {
      const timer = setTimeout(() => {
        connect();
      }, 500);

      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isLoading, wsStatus, connect]);

  const handleVisibilityChanges = useCallback(() => {
    if (
      document.visibilityState === "visible" &&
      isAuthenticated &&
      wsStatus === "disconnected"
    ) {
      connect();
    }
  }, [isAuthenticated, wsStatus, connect]);

  useEffect(() => {
    document.addEventListener("visibilitychange", handleVisibilityChanges);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChanges);
  }, [handleVisibilityChanges]);

  return null;
};

export const WebSocketManager = memo(WebSocketManagerComponent);
