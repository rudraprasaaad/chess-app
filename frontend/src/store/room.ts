/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import type {
  Room,
  RoomPlayer,
  CreateRoomPayload,
  JoinRoomPayload,
  RoomWithGame,
} from "../types/room";
import { UserStatus } from "../types/common";
import { useWebSocketStore } from "./websocket";
import { useAuthStore } from "./auth";
import { toast } from "sonner";
import { useMemo, useState, useEffect } from "react";
import { useGameStore } from "./game";

interface RoomState {
  currentRoom: Room | RoomWithGame | null;
  availableRooms: Room[];
  isInQueue: boolean;
  queueType: "guest" | "rated" | null;
  queueTimeoutEnd: number | null; // Timestamp for when the queue timeout ends
  isJoiningRoom: boolean;
  isCreatingRoom: boolean;
  error: string | null;

  createRoom: (payload: CreateRoomPayload) => void;
  joinRoom: (payload: JoinRoomPayload) => void;
  leaveRoom: () => void;
  joinQueue: (isGuest: boolean) => void;
  leaveQueue: () => void;
  setCurrentRoom: (room: Room | null) => void;
  updateRoom: (roomUpdate: Partial<Room>) => void;
  setAvailableRooms: (rooms: Room[]) => void;
  addPlayer: (player: RoomPlayer) => void;
  removePlayer: (playerId: string) => void;
  setError: (error: string | null) => void;
  clearRoom: () => void;
  setJoiningRoom: (joining: boolean) => void;
  setCreatingRoom: (creating: boolean) => void;
}

export const useRoomStore = create<RoomState>((set, get) => ({
  currentRoom: null,
  availableRooms: [],
  isInQueue: false,
  queueType: null,
  queueTimeoutEnd: null,
  isJoiningRoom: false,
  isCreatingRoom: false,
  error: null,

  createRoom: (payload) => {
    const { sendMessage } = useWebSocketStore.getState();
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      set({ error: "Must be authenticated to create room" });
      return;
    }
    set({ isCreatingRoom: true, error: null });
    sendMessage({
      type: "CREATE_ROOM",
      payload: { type: payload.type, inviteCode: payload.inviteCode },
    });
    useAuthStore.getState().setStatus(UserStatus.WAITING);
    toast.info("Creating room...");
  },

  joinRoom: (payload) => {
    const { sendMessage } = useWebSocketStore.getState();
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      set({ error: "Must be authenticated to join room" });
      return;
    }
    set({ isJoiningRoom: true, error: null });
    sendMessage({
      type: "JOIN_ROOM",
      payload: { roomId: payload.roomId, inviteCode: payload.inviteCode },
    });
    useAuthStore.getState().setStatus(UserStatus.WAITING);
    toast.info("Joining room...");
  },

  leaveRoom: () => {
    const { currentRoom } = get();
    if (!currentRoom) return;
    const { sendMessage } = useWebSocketStore.getState();
    sendMessage({
      type: "LEAVE_ROOM",
      payload: { roomId: currentRoom.id },
    });
    set({
      currentRoom: null,
      isJoiningRoom: false,
      isCreatingRoom: false,
      error: null,
    });
    useAuthStore.getState().setStatus(UserStatus.ONLINE);
    toast.success("You left the room.");
  },

  joinQueue: (isGuest) => {
    const { sendMessage } = useWebSocketStore.getState();
    const { isAuthenticated } = useAuthStore.getState();
    if (!isAuthenticated) {
      set({ error: "Must be authenticated to join queue" });
      return;
    }
    const queueType = isGuest ? "guest" : "rated";
    // Set a 30-second timeout when joining the queue
    set({
      isInQueue: true,
      queueType,
      error: null,
      queueTimeoutEnd: Date.now() + 30000,
    });
    sendMessage({ type: "JOIN_QUEUE", payload: { isGuest } });
    useAuthStore.getState().setStatus(UserStatus.WAITING);
    toast.info(`Searching for a ${queueType} match...`);
  },

  leaveQueue: () => {
    const { sendMessage } = useWebSocketStore.getState();
    sendMessage({ type: "LEAVE_QUEUE", payload: {} });
    set({
      isInQueue: false,
      queueType: null,
      queueTimeoutEnd: null,
      error: null,
    });
    useAuthStore.getState().setStatus(UserStatus.ONLINE);
    toast.info("Left matchmaking queue.");
  },

  setCurrentRoom: (room) => {
    set({
      currentRoom: room,
      isJoiningRoom: false,
      isCreatingRoom: false,
      error: null,
    });
    if (room) toast.success("Joined room!");
  },

  updateRoom: (roomUpdate) => {
    const { currentRoom } = get();
    if (currentRoom) set({ currentRoom: { ...currentRoom, ...roomUpdate } });
  },

  setAvailableRooms: (rooms) => set({ availableRooms: rooms }),

  addPlayer: (player) => {
    const { currentRoom } = get();
    if (currentRoom)
      set({
        currentRoom: {
          ...currentRoom,
          players: [...currentRoom.players, player],
        },
      });
  },

  removePlayer: (playerId) => {
    const { currentRoom } = get();
    if (currentRoom)
      set({
        currentRoom: {
          ...currentRoom,
          players: currentRoom.players.filter((p) => p.id !== playerId),
        },
      });
  },

  setError: (error) => {
    set({ error });
    if (error) toast.error(error);
  },

  clearRoom: () =>
    set({
      currentRoom: null,
      isInQueue: false,
      queueType: null,
      queueTimeoutEnd: null,
      isJoiningRoom: false,
      isCreatingRoom: false,
      error: null,
    }),

  setJoiningRoom: (joining) => set({ isJoiningRoom: joining }),
  setCreatingRoom: (creating) => set({ isCreatingRoom: creating }),
}));

export const useCurrentRoom = () =>
  useRoomStore((state) => ({
    room: state.currentRoom,
    isInRoom: state.currentRoom !== null,
    players: state.currentRoom?.players || [],
    roomStatus: state.currentRoom?.status || null,
    inviteCode: state.currentRoom?.inviteCode,
  }));

export const useQueueStatus = () =>
  useRoomStore((state) => ({
    isInQueue: state.isInQueue,
    queueType: state.queueType,
  }));

export const useQueueCountdown = (): number => {
  const queueTimeoutEnd = useRoomStore((state) => state.queueTimeoutEnd);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!queueTimeoutEnd) {
      setTimeLeft(0);
      return;
    }

    const calculateTimeLeft = () => {
      const now = Date.now();
      const difference = queueTimeoutEnd - now;
      return Math.max(0, Math.ceil(difference / 1000));
    };

    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [queueTimeoutEnd]);

  return timeLeft;
};

export const useRoomActions = () => {
  const { createRoom, joinRoom, leaveRoom, joinQueue, leaveQueue } =
    useRoomStore();
  return useMemo(
    () => ({ createRoom, joinRoom, leaveRoom, joinQueue, leaveQueue }),
    [createRoom, joinRoom, leaveRoom, joinQueue, leaveQueue]
  );
};

export const useRoomUI = () =>
  useRoomStore((state) => ({
    isJoiningRoom: state.isJoiningRoom,
    isCreatingRoom: state.isCreatingRoom,
    error: state.error,
    setError: state.setError,
  }));

export const handleRoomMessage = (message: any) => {
  const { setCurrentRoom, setError, setJoiningRoom, setCreatingRoom } =
    useRoomStore.getState();
  const { setCurrentGame } = useGameStore.getState();

  switch (message.type) {
    case "ROOM_CREATED":
      setCurrentRoom(message.payload);
      setCreatingRoom(false);
      useAuthStore.getState().setStatus(UserStatus.WAITING);
      break;

    case "QUEUE_JOINED":
      // Set the timeout when joining. Assumes a 30s timeout from backend.
      useRoomStore.setState({
        isInQueue: true,
        queueTimeoutEnd: Date.now() + 30 * 1000,
      });
      break;

    case "ROOM_UPDATED":
      useRoomStore.setState({
        isInQueue: false,
        queueType: null,
        queueTimeoutEnd: null,
      });
      setCurrentRoom(message.payload);
      if ("game" in message.payload && message.payload.game) {
        setCurrentGame(message.payload.game);
        useAuthStore.getState().setStatus(UserStatus.IN_GAME);
      }
      setJoiningRoom(false);
      break;

    case "QUEUE_TIMED_OUT":
      useRoomStore.setState({
        isInQueue: false,
        queueType: null,
        queueTimeoutEnd: null,
      });
      useAuthStore.getState().setStatus(UserStatus.ONLINE);
      toast.error("No match found. Please try again.");
      break;

    case "QUEUE_LEFT":
      useRoomStore.setState({
        isInQueue: false,
        queueType: null,
        queueTimeoutEnd: null,
      });
      useAuthStore.getState().setStatus(UserStatus.ONLINE);
      break;

    case "ERROR":
      setError(message.payload.message);
      setJoiningRoom(false);
      setCreatingRoom(false);
      useRoomStore.setState({
        isInQueue: false,
        queueType: null,
        queueTimeoutEnd: null,
      });
      useAuthStore.getState().setStatus(UserStatus.ONLINE);
      break;
  }
};
