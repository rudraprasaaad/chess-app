import { create } from "zustand";
import type { ServerMessage, ClientMessage } from "../types/websocket";
import { WS_CLOSE_CODES, RATE_LIMIT } from "../types/websocket";
import { useAuthStore } from "./auth";
import { UserStatus } from "../types/common";

export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "error";

interface WebSocketState {
  // Connection Management
  connection: WebSocket | null;
  status: ConnectionStatus;
  error: string | null;

  // Message Handling
  lastMessage: ServerMessage | null;
  messageHistory: ServerMessage[];

  // Reconnection Logic
  reconnectAttempts: number;
  maxReconnectAttempts: number;
  reconnectDelay: number;

  // Rate Limiting
  messageCount: number;
  lastReset: number;

  // Actions
  connect: () => void;
  disconnect: () => void;
  sendMessage: <T extends ClientMessage>(message: T) => void;
  setStatus: (status: ConnectionStatus) => void;
  setError: (error: string | null) => void;
  addMessage: (message: ServerMessage) => void;
  clearHistory: () => void;
  resetReconnection: () => void;
  attemptReconnection: () => void;
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

    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      set({ error: "Cannot connect: User not authenticated" });
      return;
    }

    set({ status: "connecting", error: null });

    try {
      const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsHost =
        import.meta.env.REACT_APP_WS_URL ||
        `${wsProtocol}//${window.location.host}`;
      const wsUrl = `${wsHost}/ws`;

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("WebSocket connected");
        set({
          connection: ws,
          status: "connected",
          error: null,
          reconnectAttempts: 0,
          reconnectDelay: 1000,
        });

        useAuthStore.getState().setStatus(UserStatus.ONLINE);
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
        console.log("WebSocket disconnected:", event.code, event.reason);

        set({
          connection: null,
          status: "disconnected",
        });

        useAuthStore.getState().setStatus(UserStatus.OFFLINE);

        if (event.code === WS_CLOSE_CODES.AUTH_FAILED) {
          set({ error: "Authentication failed" });
          useAuthStore.getState().clearAuth();
          return;
        }

        if (event.code === WS_CLOSE_CODES.RATE_LIMIT_EXCEEDED) {
          set({ error: "Rate limit exceeded" });
          return;
        }

        if (event.code !== 1000 && event.code !== 1001) {
          get().attemptReconnection();
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        set({
          status: "error",
          error: "Connection error occurred",
        });
      };
    } catch (error) {
      console.error("Failed to create WebSocket connection:", error);
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
  },

  sendMessage: (message) => {
    const { connection, status } = get();

    if (status !== "connected" || !connection) {
      console.warn("Cannot send message: WebSocket not connected");
      return;
    }

    const now = Date.now();
    const { messageCount, lastReset } = get();

    if (now - lastReset > RATE_LIMIT.WINDOW_MS) {
      set({ messageCount: 0, lastReset: now });
    }

    if (messageCount >= RATE_LIMIT.MAX_MESSAGES_PER_MINUTE) {
      set({ error: "Rate limit exceeded. Please slow down." });
      return;
    }

    try {
      const messageString = JSON.stringify(message);
      connection.send(messageString);
      set({ messageCount: messageCount + 1 });
      console.log("Sent WebSocket message:", message.type);
    } catch (error) {
      console.error("Failed to send WebSocket message:", error);
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
      return;
    }

    set({
      status: "reconnecting",
      reconnectAttempts: state.reconnectAttempts + 1,
      reconnectDelay: Math.min(state.reconnectDelay * 1.5, 30000),
    });

    setTimeout(() => {
      console.log(
        `Reconnection attempt ${state.reconnectAttempts + 1}/${
          state.maxReconnectAttempts
        }`
      );
      get().connect();
    }, state.reconnectDelay);
  },
}));

const handleServerMessage = (message: ServerMessage) => {
  switch (message.type) {
    case "ROOM_CREATED":
    case "ROOM_UPDATED":
      break;

    case "GAME_UPDATED":
    case "REJOIN_GAME":
      break;

    case "QUEUE_TIMEOUT":
      useAuthStore.getState().setStatus(UserStatus.ONLINE);
      break;

    case "QUEUE_LEFT":
      useAuthStore.getState().setStatus(UserStatus.ONLINE);
      break;

    case "ERROR":
      console.error("Server error:", message.payload.message);
      break;

    case "TYPING":
      break;

    default:
      console.error("Unrecognized message", (message as ServerMessage).type);
  }
};

export const useWebSocketConnection = () =>
  useWebSocketStore((state) => ({
    status: state.status,
    error: state.error,
    connect: state.connect,
    disconnect: state.disconnect,
    isConnected: state.status === "connected",
  }));

export const useWebSocketSender = () =>
  useWebSocketStore((state) => ({
    sendMessage: state.sendMessage,
    canSend: state.status === "connected",
  }));

export const useWebSocketMessages = () =>
  useWebSocketStore((state) => ({
    lastMessage: state.lastMessage,
    messageHistory: state.messageHistory,
    clearHistory: state.clearHistory,
  }));
