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
import { useMemo } from "react";
import { useGameStore } from "./game";

interface RoomState {
  currentRoom: Room | RoomWithGame | null;
  availableRooms: Room[];

  isInQueue: boolean;
  queueType: "guest" | "rated" | null;

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
      payload: {
        type: payload.type,
        inviteCode: payload.inviteCode,
      },
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
      payload: {
        roomId: payload.roomId,
        inviteCode: payload.inviteCode,
      },
    });

    useAuthStore.getState().setStatus(UserStatus.WAITING);
    toast.info("Joining room...");
  },

  leaveRoom: () => {
    const { currentRoom } = get();
    const { sendMessage } = useWebSocketStore.getState();

    if (!currentRoom) return;

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

    set({
      isInQueue: true,
      queueType,
      error: null,
    });

    sendMessage({
      type: "JOIN_QUEUE",
      payload: { isGuest },
    });

    useAuthStore.getState().setStatus(UserStatus.WAITING);
    toast.info(`Searching for a ${isGuest ? "guest" : "rated"} match...`);
  },

  leaveQueue: () => {
    const { sendMessage } = useWebSocketStore.getState();

    sendMessage({
      type: "LEAVE_QUEUE",
      payload: {},
    });

    set({
      isInQueue: false,
      queueType: null,
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
    if (room) {
      toast.success("Joined room!");
    }
  },

  updateRoom: (roomUpdate) => {
    const { currentRoom } = get();
    if (currentRoom) {
      set({ currentRoom: { ...currentRoom, ...roomUpdate } });
    }
  },

  setAvailableRooms: (rooms) => set({ availableRooms: rooms }),

  addPlayer: (player) => {
    const { currentRoom } = get();
    if (currentRoom) {
      const updatedPlayers = [...currentRoom.players, player];
      set({
        currentRoom: {
          ...currentRoom,
          players: updatedPlayers,
        },
      });
    }
  },

  removePlayer: (playerId) => {
    const { currentRoom } = get();
    if (currentRoom) {
      const updatedPlayers = currentRoom.players.filter(
        (p) => p.id !== playerId
      );
      set({
        currentRoom: {
          ...currentRoom,
          players: updatedPlayers,
        },
      });
    }
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

export const useRoomActions = () => {
  const createRoom = useRoomStore((state) => state.createRoom);
  const joinRoom = useRoomStore((state) => state.joinRoom);
  const leaveRoom = useRoomStore((state) => state.leaveRoom);
  const joinQueue = useRoomStore((state) => state.joinQueue);
  const leaveQueue = useRoomStore((state) => state.leaveQueue);

  return useMemo(
    () => ({
      createRoom,
      joinRoom,
      leaveRoom,
      joinQueue,
      leaveQueue,
    }),
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

    case "ROOM_UPDATED":
      useRoomStore.setState({ isInQueue: false, queueType: null });
      setCurrentRoom(message.payload);
      setCurrentGame(message.payload.game);
      setJoiningRoom(false);
      if (message.payload.game) {
        useAuthStore.getState().setStatus(UserStatus.IN_GAME);
      }
      break;

    case "QUEUE_TIMEOUT":
      useRoomStore.setState({ isInQueue: false, queueType: null });
      useAuthStore.getState().setStatus(UserStatus.ONLINE);
      toast.error("No match found. Please try again.");
      break;

    case "QUEUE_LEFT":
      useRoomStore.setState({
        isInQueue: false,
        queueType: null,
      });
      useAuthStore.getState().setStatus(UserStatus.ONLINE);
      break;

    case "ERROR":
      setError(message.payload.message);
      setJoiningRoom(false);
      setCreatingRoom(false);
      useAuthStore.getState().setStatus(UserStatus.ONLINE);
      break;
  }
};
