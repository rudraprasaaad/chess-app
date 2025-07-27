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

interface RoomState {
  currentRoom: Room | RoomWithGame | null;
  availableRooms: Room[];

  isInQueue: boolean;
  queueType: "guest" | "rated" | null;
  queueStartTime: number | null;
  queueTimeElapsed: number;

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
  queueStartTime: null,
  queueTimeElapsed: 0,
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
    const startTime = Date.now();

    set({
      isInQueue: true,
      queueType,
      queueStartTime: startTime,
      queueTimeElapsed: 0,
      error: null,
    });

    sendMessage({
      type: "JOIN_QUEUE",
      payload: { isGuest },
    });

    useAuthStore.getState().setStatus(UserStatus.WAITING);
    toast.info(`Searching for a ${isGuest ? "guest" : "rated"} match...`);

    const timer = setInterval(() => {
      const { isInQueue, queueStartTime } = get();
      if (!isInQueue || !queueStartTime) {
        clearInterval(timer);
        return;
      }

      const elapsed = Math.floor((Date.now() - queueStartTime) / 1000);
      set({ queueTimeElapsed: elapsed });

      if (elapsed >= 60) {
        clearInterval(timer);
        get().leaveQueue();
        toast.warning("No opponent found. Please try again.");
      }
    }, 1000);
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
      queueStartTime: null,
      queueTimeElapsed: 0,
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
      queueStartTime: null,
      queueTimeElapsed: 0,
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
    timeElapsed: state.queueTimeElapsed,
    timeRemaining: Math.max(0, 60 - state.queueTimeElapsed),
    formattedTime: formatQueueTime(state.queueTimeElapsed),
  }));

export const useRoomActions = () =>
  useRoomStore((state) => ({
    createRoom: state.createRoom,
    joinRoom: state.joinRoom,
    leaveRoom: state.leaveRoom,
    joinQueue: state.joinQueue,
    leaveQueue: state.leaveQueue,
  }));

export const useRoomUI = () =>
  useRoomStore((state) => ({
    isJoiningRoom: state.isJoiningRoom,
    isCreatingRoom: state.isCreatingRoom,
    error: state.error,
    setError: state.setError,
  }));

const formatQueueTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

export const handleRoomMessage = (message: any) => {
  const { setCurrentRoom, setError, setJoiningRoom, setCreatingRoom } =
    useRoomStore.getState();

  switch (message.type) {
    case "ROOM_CREATED":
      setCurrentRoom(message.payload);
      setCreatingRoom(false);
      useAuthStore.getState().setStatus(UserStatus.WAITING);
      break;

    case "ROOM_UPDATED":
      setCurrentRoom(message.payload);
      setJoiningRoom(false);

      // Check if game started
      if (message.payload.game) {
        useAuthStore.getState().setStatus(UserStatus.IN_GAME);
      }
      break;

    case "QUEUE_TIMEOUT":
      useRoomStore.getState().leaveQueue();
      setError("No match found. Please try again.");
      break;

    case "QUEUE_LEFT":
      useRoomStore.setState({
        isInQueue: false,
        queueType: null,
        queueStartTime: null,
        queueTimeElapsed: 0,
      });
      break;

    case "ERROR":
      setError(message.payload.message);
      setJoiningRoom(false);
      setCreatingRoom(false);
      useAuthStore.getState().setStatus(UserStatus.ONLINE);
      break;
  }
};
