/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { toast } from "sonner";
import type { Game, Move, ChatMessage } from "../types/game";
import { GameStatus, UserStatus } from "../types/common";
import { useWebSocketStore } from "./websocket";
import { useAuthStore } from "./auth";

interface GameState {
  currentGame: Game | null;
  gameHistory: Game[];

  selectedSquare: string | null;
  legalMoves: string[];
  lastMove: Move | null;

  isPlayerTurn: boolean;
  playerColor: "white" | "black" | null;

  whiteTimeLeft: number;
  blackTimeLeft: number;
  timerInterval: ReturnType<typeof setInterval> | null;

  chatMessages: ChatMessage[];
  isTyping: boolean;
  typingUsers: string[];

  isMakingMove: boolean;
  isGameLoading: boolean;
  error: string | null;

  setCurrentGame: (game: Game | null) => void;
  updateGame: (gameUpdate: Partial<Game>) => void;
  makeMove: (move: { from: string; to: string; promotion?: string }) => void;

  setSelectedSquare: (square: string | null) => void;
  setLegalMoves: (moves: string[]) => void;
  clearSelection: () => void;

  startTimer: () => void;
  stopTimer: () => void;
  updateTimers: (white: number, black: number) => void;

  sendChatMessage: (message: string) => void;
  startTyping: () => void;
  stopTyping: () => void;
  addChatMessage: (message: ChatMessage) => void;

  addToHistory: (game: Game) => void;
  setPlayerColor: (color: "white" | "black" | null) => void;
  setIsPlayerTurn: (isTurn: boolean) => void;
  setError: (error: string | null) => void;
  clearGame: () => void;

  setMakingMove: (making: boolean) => void;
  setGameLoading: (loading: boolean) => void;
}

export const useGameStore = create<GameState>((set, get) => ({
  currentGame: null,
  gameHistory: [],
  selectedSquare: null,
  legalMoves: [],
  lastMove: null,
  isPlayerTurn: false,
  playerColor: null,
  whiteTimeLeft: 600,
  blackTimeLeft: 600,
  timerInterval: null,
  chatMessages: [],
  isTyping: false,
  typingUsers: [],
  isMakingMove: false,
  isGameLoading: false,
  error: null,

  setCurrentGame: (game) => {
    const { user } = useAuthStore.getState();

    if (game && user) {
      const player = game.players.find((p) => p.userId === user.id);
      const playerColor = (player?.color as "white" | "black") || null;

      const currentTurn = game.fen.split(" ")[1]; // Extract turn from FEN
      const isPlayerTurn = playerColor === currentTurn;

      set({
        currentGame: game,
        playerColor,
        isPlayerTurn,
        whiteTimeLeft: game.timers.white,
        blackTimeLeft: game.timers.black,
        chatMessages: game.chat || [],
        selectedSquare: null,
        legalMoves: [],
        error: null,
        isGameLoading: false,
      });

      // Start timer if game is active
      if (game.status === GameStatus.ACTIVE) {
        get().startTimer();
      }
    } else {
      set({
        currentGame: null,
        playerColor: null,
        isPlayerTurn: false,
        selectedSquare: null,
        legalMoves: [],
        error: null,
      });

      get().stopTimer();
    }
  },

  updateGame: (gameUpdate) => {
    const { currentGame } = get();
    if (currentGame) {
      const updatedGame = { ...currentGame, ...gameUpdate };

      if (gameUpdate.timers) {
        set({
          whiteTimeLeft: gameUpdate.timers.white,
          blackTimeLeft: gameUpdate.timers.black,
        });
      }

      if (gameUpdate.fen) {
        const { user } = useAuthStore.getState();
        const { playerColor } = get();

        if (user && playerColor) {
          const currentTurn = gameUpdate.fen.split(" ")[1];
          const isPlayerTurn = playerColor === currentTurn;
          set({ isPlayerTurn });
        }
      }

      if (gameUpdate.chat) {
        set({ chatMessages: gameUpdate.chat });
      }

      set({ currentGame: updatedGame });

      if (gameUpdate.status && gameUpdate.status !== GameStatus.ACTIVE) {
        get().stopTimer();

        get().addToHistory(updatedGame);

        useAuthStore.getState().setStatus(UserStatus.ONLINE);
      }
    }
  },

  makeMove: (move) => {
    const { currentGame, isPlayerTurn, isMakingMove } = get();
    const { sendMessage } = useWebSocketStore.getState();

    if (!currentGame || !isPlayerTurn || isMakingMove) {
      return;
    }

    set({ isMakingMove: true, error: null });

    sendMessage({
      type: "MAKE_MOVE",
      payload: {
        gameId: currentGame.id,
        move: {
          from: move.from,
          to: move.to,
        },
      },
    });

    get().clearSelection();
  },

  setSelectedSquare: (square) => set({ selectedSquare: square }),

  setLegalMoves: (moves) => set({ legalMoves: moves }),

  clearSelection: () =>
    set({
      selectedSquare: null,
      legalMoves: [],
    }),

  startTimer: () => {
    const { timerInterval } = get();

    if (timerInterval) {
      clearInterval(timerInterval);
    }

    const newInterval = setInterval(() => {
      const { currentGame, whiteTimeLeft, blackTimeLeft } = get();

      if (!currentGame || currentGame.status !== GameStatus.ACTIVE) {
        get().stopTimer();
        return;
      }

      const currentTurn = currentGame.fen.split(" ")[1];

      if (currentTurn === "w" && whiteTimeLeft > 0) {
        set({ whiteTimeLeft: whiteTimeLeft - 1 });
      } else if (currentTurn === "b" && blackTimeLeft > 0) {
        set({ blackTimeLeft: blackTimeLeft - 1 });
      }

      if (
        (currentTurn === "w" && whiteTimeLeft <= 1) ||
        (currentTurn === "b" && blackTimeLeft <= 1)
      ) {
        get().stopTimer();
      }
    }, 1000);

    set({ timerInterval: newInterval });
  },

  stopTimer: () => {
    const { timerInterval } = get();
    if (timerInterval) {
      clearInterval(timerInterval);
      set({ timerInterval: null });
    }
  },

  updateTimers: (white, black) => {
    set({
      whiteTimeLeft: white,
      blackTimeLeft: black,
    });
  },

  sendChatMessage: (message) => {
    const { currentGame } = get();
    const { sendMessage } = useWebSocketStore.getState();

    if (!currentGame || !message.trim()) {
      return;
    }

    sendMessage({
      type: "CHAT_MESSAGE",
      payload: {
        gameId: currentGame.id,
        message: message.trim(),
      },
    });
    toast.success("Message sent!");
  },

  startTyping: () => {
    const { currentGame, isTyping } = get();
    const { sendMessage } = useWebSocketStore.getState();

    if (!currentGame || isTyping) {
      return;
    }

    set({ isTyping: true });

    sendMessage({
      type: "TYPING",
      payload: {
        // Reconnection Logic
        gameId: currentGame.id,
      },
    });

    setTimeout(() => {
      set({ isTyping: false });
    }, 3000);
  },

  stopTyping: () => {
    set({ isTyping: false });
  },

  addChatMessage: (message) => {
    const { chatMessages } = get();
    set({
      chatMessages: [...chatMessages, message],
    });
  },

  addToHistory: (game) => {
    const { gameHistory } = get();
    const updatedHistory = [game, ...gameHistory.slice(0, 9)];
    set({ gameHistory: updatedHistory });
  },

  setPlayerColor: (color) => set({ playerColor: color }),

  setIsPlayerTurn: (isTurn) => set({ isPlayerTurn: isTurn }),

  setError: (err) => {
    set({ error: err });
    if (err) toast.error(err);
  },

  clearGame: () => {
    get().stopTimer();
    set({
      currentGame: null,
      selectedSquare: null,
      legalMoves: [],
      lastMove: null,
      isPlayerTurn: false,
      playerColor: null,
      chatMessages: [],
      isTyping: false,
      typingUsers: [],
      isMakingMove: false,
      isGameLoading: false,
      error: null,
    });
  },

  setMakingMove: (making) => set({ isMakingMove: making }),
  setGameLoading: (loading) => set({ isGameLoading: loading }),
}));

export const useCurrentGame = () =>
  useGameStore((state) => ({
    game: state.currentGame,
    isInGame: state.currentGame !== null,
    gameStatus: state.currentGame?.status || null,
    playerColor: state.playerColor,
    isPlayerTurn: state.isPlayerTurn,
    fen: state.currentGame?.fen || "",
    moveHistory: state.currentGame?.moveHistory || [],
  }));

export const useBoardState = () =>
  useGameStore((state) => ({
    selectedSquare: state.selectedSquare,
    legalMoves: state.legalMoves,
    lastMove: state.lastMove,
    setSelectedSquare: state.setSelectedSquare,
    setLegalMoves: state.setLegalMoves,
    clearSelection: state.clearSelection,
  }));

export const useGameTimer = () =>
  useGameStore((state) => ({
    whiteTimeLeft: state.whiteTimeLeft,
    blackTimeLeft: state.blackTimeLeft,
    formatTime: (seconds: number) => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    },
  }));

export const useGameChat = () =>
  useGameStore((state) => ({
    messages: state.chatMessages,
    isTyping: state.isTyping,
    typingUsers: state.typingUsers,
    sendMessage: state.sendChatMessage,
    startTyping: state.startTyping,
    stopTyping: state.stopTyping,
  }));

export const useGameActions = () =>
  useGameStore((state) => ({
    makeMove: state.makeMove,
    isMakingMove: state.isMakingMove,
    error: state.error,
    setError: state.setError,
  }));

export const handleGameMessage = (message: any) => {
  const {
    setCurrentGame,
    updateGame,
    addChatMessage,
    setMakingMove,
    setError,
  } = useGameStore.getState();

  switch (message.type) {
    case "GAME_UPDATED":
    case "REJOIN_GAME":
      setCurrentGame(message.payload);
      setMakingMove(false);
      break;

    case "MOVE_MADE":
      updateGame(message.payload);
      setMakingMove(false);
      break;

    case "GAME_ENDED":
      updateGame({
        status: GameStatus.COMPLETED,
        winnerId: message.payload.winnerId,
      });
      break;

    case "CHAT_MESSAGE":
      addChatMessage(message.payload);
      break;

    case "TYPING":
      if (message.payload.playerId) {
        const { typingUsers } = useGameStore.getState();
        if (!typingUsers.includes(message.payload.playerId)) {
          useGameStore.setState({
            typingUsers: [...typingUsers, message.payload.playerId],
          });

          setTimeout(() => {
            const currentTyping = useGameStore.getState().typingUsers;
            useGameStore.setState({
              typingUsers: currentTyping.filter(
                (id) => id !== message.payload.playerId
              ),
            });
          }, 3000);
        }
      }
      break;

    case "ERROR":
      setError(message.payload.message);
      setMakingMove(false);
      break;
  }
};
