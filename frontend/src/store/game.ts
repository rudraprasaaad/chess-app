/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { toast } from "sonner";
import type { Game, Move, ChatMessage } from "../types/game";
import { GameStatus, UserStatus } from "../types/common";
import { useWebSocketStore } from "./websocket";
import { useAuthStore } from "./auth";
import { useEffect, useMemo } from "react";

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

  drawOffer: {
    isOpen: boolean;
    playerName: string;
    playerId: string;
  } | null;

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
  addChatMessage: (message: ChatMessage[]) => void;

  setDrawOffer: (
    offer: { playerName: string; playerId: string; isOpen: boolean } | null
  ) => void;
  acceptDraw: () => void;
  declineDraw: () => void;

  addToHistory: (game: Game) => void;
  setPlayerColor: (color: "white" | "black" | null) => void;
  setIsPlayerTurn: (isTurn: boolean) => void;
  setError: (error: string | null) => void;
  clearGame: () => void;

  setMakingMove: (making: boolean) => void;
  setGameLoading: (loading: boolean) => void;

  pendingPromotionMove: { from: string; to: string } | null;
  isPromotionModalOpen: boolean;
  requestPromotion: (move: { from: string; to: string }) => void;
  submitPromotion: (promotion: "q" | "r" | "b" | "n") => void;
  cancelPromotion: () => void;
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
  drawOffer: null,
  isMakingMove: false,
  isGameLoading: false,
  error: null,
  pendingPromotionMove: null,
  isPromotionModalOpen: false,

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
        drawOffer: null,
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
        drawOffer: null,
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

  setSelectedSquare: (square: string | null) => set({ selectedSquare: square }),

  setLegalMoves: (moves) => set({ legalMoves: moves }),

  requestPromotion: (move) => {
    set({
      pendingPromotionMove: move,
      isPromotionModalOpen: true,
    });
  },

  submitPromotion: (promotion) => {
    const { pendingPromotionMove, currentGame } = get();
    const { sendMessage } = useWebSocketStore.getState();

    if (pendingPromotionMove && currentGame) {
      sendMessage({
        type: "MAKE_MOVE",
        payload: {
          gameId: currentGame.id,
          move: {
            from: pendingPromotionMove?.from,
            to: pendingPromotionMove?.to,
            promotion,
          },
        },
      });
    }
    set({
      pendingPromotionMove: null,
      isPromotionModalOpen: false,
      selectedSquare: null,
      legalMoves: [],
    });
  },

  cancelPromotion: () => {
    set({ pendingPromotionMove: null, isPromotionModalOpen: false });
  },

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
        const newTime = whiteTimeLeft - 1;
        set({ whiteTimeLeft: Math.max(0, newTime) });

        if (newTime === 0) {
          get().stopTimer();
          toast.error("White's time has run out!");
        }
      } else if (currentTurn === "b" && blackTimeLeft > 0) {
        const newTime = blackTimeLeft - 1;
        set({ blackTimeLeft: Math.max(0, newTime) });

        if (newTime === 0) {
          get().stopTimer();
          toast.error("Black's time has run out");
        }
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

  addChatMessage: (message: ChatMessage[]) => {
    set({
      chatMessages: message,
    });
  },

  setDrawOffer: (offer) => set({ drawOffer: offer }),

  acceptDraw: () => {
    const { currentGame, drawOffer } = get();
    const { sendMessage } = useWebSocketStore.getState();

    if (currentGame && drawOffer) {
      sendMessage({
        type: "ACCEPT_DRAW",
        payload: { gameId: currentGame.id },
      });
      set({ drawOffer: null });
    }
  },

  declineDraw: () => {
    const { currentGame, drawOffer } = get();
    const { sendMessage } = useWebSocketStore.getState();

    if (currentGame && drawOffer) {
      sendMessage({
        type: "ACCEPT_DRAW",
        payload: { gameId: currentGame.id },
      });
      set({ drawOffer: null });
      toast.info("Draw offer declined");
    }
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
      whiteTimeLeft: 600,
      blackTimeLeft: 600,
      chatMessages: [],
      isTyping: false,
      typingUsers: [],
      drawOffer: null,
      isMakingMove: false,
      isGameLoading: false,
      error: null,
    });
  },

  setMakingMove: (making) => set({ isMakingMove: making }),
  setGameLoading: (loading) => set({ isGameLoading: loading }),
}));

export const useCurrentGame = () => {
  const game = useGameStore((state) => state.currentGame);
  const isInGame = useGameStore((state) => state.currentGame !== null);
  const gameStatus = useGameStore((state) => state.currentGame?.status || null);
  const playerColor = useGameStore((state) => state.playerColor);
  const isPlayerTurn = useGameStore((state) => state.isPlayerTurn);
  const fen = useGameStore((state) => state.currentGame?.fen || "");
  const moveHistory = useGameStore(
    (state) => state.currentGame?.moveHistory || []
  );

  return useMemo(
    () => ({
      game,
      isInGame,
      gameStatus,
      playerColor,
      isPlayerTurn,
      fen,
      moveHistory,
    }),
    [game, isInGame, gameStatus, playerColor, isPlayerTurn, fen, moveHistory]
  );
};

export const useBoardState = () => {
  const selectedSquare = useGameStore((state) => state.selectedSquare);
  const legalMoves = useGameStore((state) => state.legalMoves);
  const lastMove = useGameStore((state) => state.lastMove);
  const setSelectedSquare = useGameStore((state) => state.setSelectedSquare);
  const setLegalMoves = useGameStore((state) => state.setLegalMoves);
  const clearSelection = useGameStore((state) => state.clearSelection);

  return useMemo(
    () => ({
      selectedSquare,
      legalMoves,
      lastMove,
      setSelectedSquare,
      setLegalMoves,
      clearSelection,
    }),
    [
      selectedSquare,
      legalMoves,
      lastMove,
      setSelectedSquare,
      setLegalMoves,
      clearSelection,
    ]
  );
};

export const useGameTimer = () => {
  const whiteTimeLeft = useGameStore((state) => state.whiteTimeLeft);
  const blackTimeLeft = useGameStore((state) => state.blackTimeLeft);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return useMemo(
    () => ({
      whiteTimeLeft,
      blackTimeLeft,
      formatTime,
    }),
    [whiteTimeLeft, blackTimeLeft]
  );
};

export const useGameChat = () => {
  const messages = useGameStore((state) => state.chatMessages);
  const isTyping = useGameStore((state) => state.isTyping);
  const typingUsers = useGameStore((state) => state.typingUsers);
  const sendMessage = useGameStore((state) => state.sendChatMessage);
  const startTyping = useGameStore((state) => state.startTyping);
  const stopTyping = useGameStore((state) => state.stopTyping);

  return useMemo(
    () => ({
      messages,
      isTyping,
      typingUsers,
      sendMessage,
      startTyping,
      stopTyping,
    }),
    [messages, isTyping, typingUsers, sendMessage, startTyping, stopTyping]
  );
};

export const useDrawOffer = () => {
  const drawOffer = useGameStore((state) => state.drawOffer);
  const acceptDraw = useGameStore((state) => state.acceptDraw);
  const declineDraw = useGameStore((state) => state.declineDraw);

  return useMemo(
    () => ({
      drawOffer,
      acceptDraw,
      declineDraw,
    }),
    [drawOffer, acceptDraw, declineDraw]
  );
};

export const useGameCleanup = () => {
  useEffect(() => {
    return () => {
      const { stopTimer } = useGameStore.getState();
      stopTimer();
    };
  }, []);
};

export const useGameActions = () => {
  const makeMove = useGameStore((state) => state.makeMove);
  const isMakingMove = useGameStore((state) => state.isMakingMove);
  const error = useGameStore((state) => state.error);
  const setError = useGameStore((state) => state.setError);
  const setSelectedSquare = useGameStore((state) => state.setSelectedSquare);
  const clearSelection = useGameStore((state) => state.clearSelection);

  return useMemo(
    () => ({
      makeMove,
      isMakingMove,
      error,
      setError,
      setSelectedSquare,
      clearSelection,
    }),
    [makeMove, isMakingMove, error, setError, setSelectedSquare, clearSelection]
  );
};

export const handleGameMessage = (message: any) => {
  const {
    setCurrentGame,
    updateGame,
    addChatMessage,
    setMakingMove,
    setError,
    stopTimer,
    setDrawOffer,
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
      stopTimer();
      break;

    case "PLAYER_RESIGNED":
      updateGame({
        status: GameStatus.COMPLETED,
        winnerId: message.payload.winnerId,
      });
      toast.info(`${message.payload.playerName} resigned`);
      stopTimer();
      break;

    case "DRAW_OFFERED":
      setDrawOffer({
        isOpen: true,
        playerName: message.payload.playerName,
        playerId: message.payload.playerId,
      });
      toast.info(`${message.payload.playerName} offered a draw`);
      break;

    case "DRAW_ACCEPTED":
      updateGame({ status: GameStatus.DRAW });
      toast.success("Draw Accepted!");
      stopTimer();
      break;

    case "DRAW_DECLINED":
      toast.info("Your draw offer was declined");
      break;

    case "DRAW_OFFER_SENT":
      toast.success("Draw offer sent to opponent");
      break;

    case "TIME_OUT":
      updateGame({
        status: GameStatus.COMPLETED,
        winnerId: message.payload.winnerId,
      });
      toast.error("Time's up!");
      stopTimer();
      break;

    case "ILLEGAL_MOVE":
      setError("Illegal move attempted");
      setMakingMove(false);
      break;

    case "CHAT_MESSAGE":
      addChatMessage(message.payload.chat);
      console.log(message.payload.chat);
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
