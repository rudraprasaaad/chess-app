import { create } from "zustand";
import { toast } from "sonner";
import type { ServerMessage, ClientMessage } from "../types/websocket";
import { WS_CLOSE_CODES, RATE_LIMIT } from "../types/websocket";
import { useAuthStore } from "./auth";
import { UserStatus } from "../types/common";
import { handleRoomMessage } from "./room";
import { handleGameMessage } from "./game";
import { useMemo } from "react";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

interface WebSocketState {
  connection: WebSocket | null;
  status: ConnectionStatus;
  error: string | null;

  lastMessage: ServerMessage | null;
  messageHistory: ServerMessage[];

  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;

  messageCount: number;
  lastReset: number;

  connect: () => void;
  disconnect: () => void;
  sendMessage: <T extends ClientMessage>(message: T) => void;
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  addMessage: (message: ServerMessage) => void;
  clearHistory: () => void;
  resetReconnection: () => void;
  attemptReconnection: () => void;
  handleAuthStateChange: (isAuthenticated: boolean) => void;
}

export const useWebSocketStore = create<WebSocketState>((set, get) => ({
  connection: null,
  status: "disconnected",
  error: null,
  lastMessage: null,
  messageHistory: [],
  reconnectAttempts: 0,
  maxReconnectAttempts: 5,
  reconnectDelay: 1000,
  messageCount: 0,
  lastReset: Date.now(),

  connect: () => {
    const { connection, status } = get();

    if (connection?.readyState === WebSocket.OPEN || status === "connecting") {
      return;
    }

    const authState = useAuthStore.getState();
    if (!authState.isAuthenticated || authState.isLoading) {
      set({ error: "Cannot connect: User not authenticated" });
      return;
    }

    set({ status: "connecting", error: null });

    try {
      const wsHost = import.meta.env.VITE_WS_URL_DEV;
      const wsUrl = `${wsHost}`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        set({
          connection: ws,
          status: "connected",
          error: null,
          reconnectAttempts: 0,
          reconnectDelay: 1000,
        });

        useAuthStore.getState().setStatus(UserStatus.ONLINE);
        toast.success("Connected to the server!");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as ServerMessage;
          get().addMessage(message);
          handleServerMessage(message);
        } catch (error) {
          console.error("Failed to parse WebSocket message:", error);
        }
      };

      ws.onclose = (event) => {
        set({
          connection: null,
          status: "disconnected",
        });

        useAuthStore.getState().setStatus(UserStatus.OFFLINE);

        if (event.code === WS_CLOSE_CODES.AUTH_FAILED) {
          set({ error: "Authentication failed" });
          toast.error("Authentication failed. Please log in again.");
          useAuthStore.getState().clearAuth();
          return;
        } else if (event.code === WS_CLOSE_CODES.RATE_LIMIT_EXCEEDED) {
          set({ error: "Rate limit exceeded" });
          toast.warning("Rate limit exceeded. Try again in a minute.");
          return;
        } else if (event.code !== 1000 && event.code !== 1001) {
          toast.info("Disconnected. Attempting to reconnect...");
          if (authState.isAuthenticated) {
            get().attemptReconnection();
          }
        }
      };

      ws.onerror = () => {
        set({
          status: "error",
          error: "Connection error occurred",
        });
        toast.error("WebSocket connection error.");
      };
    } catch {
      set({
        status: "error",
        error: "Failed to establish connection",
      });
    }
  },

  disconnect: () => {
    const { connection } = get();

    if (connection) {
      connection.close(1000, "Client disconnect");
    }

    set({
      connection: null,
      status: "disconnected",
      error: null,
      reconnectAttempts: 0,
    });
    toast.info("Disconnected from the server.");
  },

  sendMessage: (message) => {
    const { connection, status } = get();

    if (status !== "connected" || !connection) {
      toast.warning("Cannot send message: WebSocket not connected");
      return;
    }

    const now = Date.now();
    const { messageCount, lastReset } = get();

    if (now - lastReset > RATE_LIMIT.WINDOW_MS) {
      set({ messageCount: 0, lastReset: now });
    }

    if (messageCount >= RATE_LIMIT.MAX_MESSAGES_PER_MINUTE) {
      toast.warning(
        "Rate limit exceeded! Please wait before sending more messages."
      );
      set({ error: "Rate limit exceeded. Please slow down." });
      return;
    }

    try {
      const messageString = JSON.stringify(message);
      connection.send(messageString);
      set({ messageCount: messageCount + 1 });
    } catch {
      set({ error: "Failed to send message" });
    }
  },

  setStatus: (status) => set({ status }),
  setError: (error) => set({ error }),

  addMessage: (message) => {
    const { messageHistory } = get();
    set({
      lastMessage: message,
      messageHistory: [...messageHistory.slice(-49), message],
    });
  },

  clearHistory: () =>
    set({
      messageHistory: [],
      lastMessage: null,
    }),

  resetReconnection: () =>
    set({
      reconnectAttempts: 0,
      reconnectDelay: 1000,
    }),

  attemptReconnection: () => {
    const state = get();

    if (state.reconnectAttempts >= state.maxReconnectAttempts) {
      set({
        status: "error",
        error: "Maximum reconnection attempts reached",
      });
      toast.error("Could not reconnect to server. Please reload the page.");
      return;
    }

    set({
      status: "reconnecting",
      reconnectAttempts: state.reconnectAttempts + 1,
      reconnectDelay: Math.min(state.reconnectDelay * 1.5, 30000),
    });

    setTimeout(() => {
      const currentAuthState = useAuthStore.getState();
      if (currentAuthState.isAuthenticated) {
        toast.info(
          `Reconnecting (${state.reconnectAttempts + 1}/${
            state.maxReconnectAttempts
          })...`
        );
        get().connect();
      }
    }, state.reconnectDelay);
  },

  handleAuthStateChange: (isAuthenticated: boolean) => {
    const { connection, status } = get();

    if (isAuthenticated && status === "disconnected") {
      setTimeout(() => get().connect(), 100);
    } else if (!isAuthenticated && connection) {
      get().disconnect();
    }
  },
}));

const handleServerMessage = (message: ServerMessage) => {
  const roomMessages = [
    "ROOM_CREATED",
    "ROOM_UPDATED",
    "QUEUE_TIMEOUT",
    "QUEUE_LEFT",
  ];

  const gameMessages = [
    "GAME_UPDATED",
    "TIMER_UPDATE",
    "GAME_LOADED",
    "GAME_NOT_FOUND",
    "UNAUTHORIZED",
    "INVAILD_GAME_ID",
    "LOAD_GAME_ERROR",
    "REJOIN_GAME",
    "MOVE_MADE",
    "LEGAL_MOVES_UPDATE",
    "GAME_ENDED",
    "PLAYER_RESIGNED",
    "DRAW_OFFERED",
    "DRAW_ACCEPTED",
    "DRAW_DECLINED",
    "DRAW_OFFER_SENT",
    "TIME_OUT",
    "ILLEGAL_MOVE",
    "CHAT_MESSAGE",
    "TYPING",
  ];

  if (roomMessages.includes(message.type)) handleRoomMessage(message);
  else if (gameMessages.includes(message.type)) handleGameMessage(message);
  else {
    switch (message.type) {
      case "ERROR":
        handleGameMessage(message);
        handleRoomMessage(message);
        break;

      default:
        console.warn("Unhandled message type", message.type);
    }
  }
};

export const useWebSocketConnection = () => {
  const status = useWebSocketStore((state) => state.status);
  const error = useWebSocketStore((state) => state.error);
  const connect = useWebSocketStore((state) => state.connect);
  const disconnect = useWebSocketStore((state) => state.disconnect);
  const isConnected = useWebSocketStore(
    (state) => state.status === "connected"
  );

  return useMemo(
    () => ({
      status,
      error,
      connect,
      disconnect,
      isConnected,
    }),
    [status, error, connect, disconnect, isConnected]
  );
};

export const useWebSocketSender = () => {
  const sendMessage = useWebSocketStore((state) => state.sendMessage);
  const canSend = useWebSocketStore((state) => state.status === "connected");

  return useMemo(
    () => ({
      sendMessage,
      canSend,
    }),
    [sendMessage, canSend]
  );
};

export const useWebSocketMessages = () => {
  const lastMessage = useWebSocketStore((state) => state.lastMessage);
  const messageHistory = useWebSocketStore((state) => state.messageHistory);
  const clearHistory = useWebSocketStore((state) => state.clearHistory);

  return useMemo(
    () => ({
      lastMessage,
      messageHistory,
      clearHistory,
    }),
    [lastMessage, messageHistory, clearHistory]
  );
};
