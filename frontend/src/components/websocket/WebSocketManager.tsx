import { useEffect } from "react";
import { useAuthStore } from "../../store/auth";
import { useWebSocketStore } from "../../store/websocket";

export const WebSocketManager = () => {
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

  useEffect(() => {
    const handleVisibilityChanges = () => {
      if (
        document.visibilityState === "visible" &&
        isAuthenticated &&
        wsStatus === "disconnected"
      ) {
        connect();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChanges);
    return () =>
      document.removeEventListener("visibilitychange", handleVisibilityChanges);
  }, [isAuthenticated, wsStatus, connect]);

  return null;
};
