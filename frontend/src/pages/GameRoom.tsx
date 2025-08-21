import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoomStore } from "../store/room";
import { useAuthStore } from "../store/auth";
import PlayerTime from "../components/game/PlayerTimer";
import MoveHistory from "../components/game/MoveHistory";
import GameControls from "../components/game/GameControls";
import ChessBoard from "../components/game/ChessBoard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Crown } from "lucide-react";
import { useGameStore } from "../store/game";
import PromotionModal from "../components/game/PromotionModal";
import { GameStatus } from "../types/common";
import GameEndModal from "../components/game/GameEndModal";
import GameChat from "../components/game/GameChat";
import { useWebSocketConnection, useWebSocketSender } from "../store/websocket";

const GameRoom = () => {
  const navigate = useNavigate();
  const { gameId } = useParams<{ gameId: string }>();

  const { user } = useAuthStore();
  const { isConnected } = useWebSocketConnection();
  const { sendMessage } = useWebSocketSender();

  const joinQueue = useRoomStore((state) => state.joinQueue);

  const currentGame = useGameStore((state) => state.currentGame);
  const clearGame = useGameStore((state) => state.clearGame);
  const clearRoom = useRoomStore((state) => state.clearRoom);

  const currentTurn = useGameStore(
    (state) => state.currentGame?.fen.split(" ")[1]
  );
  const isPromotionOpen = useGameStore((state) => state.isPromotionModalOpen);
  const submitPromotion = useGameStore((state) => state.submitPromotion);
  const cancelPromotion = useGameStore((state) => state.cancelPromotion);

  const [endModalOpen, setModalOpen] = useState(false);
  const [endResult, setEndResult] = useState<
    "win" | "loss" | "draw" | "timeout" | "resign" | null
  >(null);
  const [endReasonMessage, setEndReasonMessage] = useState<string | undefined>(
    undefined
  );

  const modalOpenedRef = useRef(false);

  useEffect(() => {
    if (!gameId) {
      navigate("/lobby");
      return;
    }

    if (isConnected) {
      if (!currentGame || currentGame.id !== gameId) {
        sendMessage({
          type: "REQUEST_REJOIN",
          payload: { gameId },
        });
      }
    }
  }, [isConnected, gameId, currentGame, sendMessage, navigate]);

  useEffect(() => {
    if (!currentGame || currentGame.id !== gameId) return;

    const isGameEnded = [
      GameStatus.COMPLETED,
      GameStatus.DRAW,
      GameStatus.ABANDONED,
      GameStatus.RESIGNED,
    ].includes(currentGame.status);

    if (isGameEnded && !modalOpenedRef.current) {
      modalOpenedRef.current = true;

      const userId = user?.id;
      let res: typeof endResult = null;
      let reason: string | undefined = undefined;

      if (currentGame.status === GameStatus.RESIGNED) {
        res = currentGame.winnerId === userId ? "win" : "loss";
        if (res === "win") {
          const opponent = currentGame.players.find((p) => p.userId !== userId);
          reason = `${opponent?.name || "Your opponent"} resigned.`;
        } else {
          reason = "You resigned the game.";
        }
      } else if (currentGame.status === GameStatus.DRAW) {
        res = "draw";
        reason = "The game is a draw.";
      } else if (currentGame.status === GameStatus.COMPLETED) {
        res = currentGame.winnerId === userId ? "win" : "loss";
        reason =
          res === "win" ? "You won by checkmate!" : "You lost by checkmate.";
      } else if (currentGame.status === GameStatus.ABANDONED) {
        res = currentGame.winnerId === userId ? "win" : "loss";
        reason = "Your opponent disconnected and abandoned the game.";
      }

      setEndResult(res);
      setEndReasonMessage(reason);
      setModalOpen(true);
    } else if (!isGameEnded && modalOpenedRef.current) {
      modalOpenedRef.current = false;
      setModalOpen(false);
      setEndResult(null);
      setEndReasonMessage(undefined);
    }
  }, [currentGame, gameId, user?.id]);

  const handleSelectPromotion = useCallback(
    (piece: "q" | "r" | "b" | "n") => {
      submitPromotion(piece);
    },
    [submitPromotion]
  );

  const handleCancelPromotion = useCallback(() => {
    cancelPromotion();
  }, [cancelPromotion]);

  const handleEndModalClose = () => {
    setModalOpen(false);
    clearGame();
    clearRoom();
    navigate("/lobby");
  };

  const handlePlayAgain = () => {
    setModalOpen(false);
    clearGame();
    clearRoom();
    navigate("/lobby");
    joinQueue(true);
  };

  const { whitePlayer, blackPlayer } = useMemo(() => {
    if (!currentGame?.players) return { whitePlayer: null, blackPlayer: null };

    const white = currentGame.players.find((p) => p.color === "white");
    const black = currentGame.players.find((p) => p.color === "black");

    return { whitePlayer: white, blackPlayer: black };
  }, [currentGame?.players]);

  const currentPlayerColor = useMemo(() => {
    return currentGame?.players.find((p) => p.userId === user?.id)?.color;
  }, [currentGame?.players, user?.id]);

  const boardOrientation = useMemo(() => {
    return currentPlayerColor === "black" ? "black" : "white";
  }, [currentPlayerColor]);

  const TopPlayer = boardOrientation === "white" ? blackPlayer : whitePlayer;
  const BottomPlayer = boardOrientation === "white" ? whitePlayer : blackPlayer;
  const TopPlayerColor = boardOrientation === "white" ? "black" : "white";
  const BottomPlayerColor = boardOrientation === "white" ? "white" : "black";

  if (!currentGame || currentGame.id !== gameId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center glass p-8 rounded-xl"
        >
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg font-heading text-foreground">
            {isConnected ? "Loading Game..." : "Connecting to Server..."}
          </p>
          {!isConnected && (
            <p className="text-sm text-muted-foreground mt-2">
              Waiting for server connection to rejoin game.
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background overflow-hidden flex flex-col">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-chess-gold/5 rounded-full blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.5, 0.3, 0.5] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
        <div className="absolute inset-0 chess-pattern opacity-[0.02]" />
      </div>

      <div className="flex-shrink-0"></div>

      <div className="relative z-10 flex-1 min-h-0 flex justify-center">
        <div className="w-full max-w-7xl h-full px-4 py-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full"
          >
            <div className="flex flex-col xl:flex-row gap-6 h-full">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2, duration: 0.6 }}
                className="hidden xl:flex w-full max-w-xs flex-col min-h-0 space-y-4"
              >
                <Card className="glass border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-base">
                      <Crown className="w-4 h-4 mr-2 text-chess-gold" />
                      Game Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-white/5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Status
                      </span>
                      <span className="text-xs font-bold capitalize text-chess-gold px-2 py-1 bg-chess-gold/10 rounded">
                        {currentGame.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-white/5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Turn
                      </span>
                      <span className="text-xs font-semibold flex items-center">
                        <div
                          className={`w-3 h-3 rounded-full mr-1.5 border ${
                            currentTurn === "w"
                              ? "bg-white border-gray-400"
                              : "bg-gray-900 border-gray-600"
                          }`}
                        />
                        {currentTurn === "w" ? "White" : "Black"}
                      </span>
                    </div>
                    {currentPlayerColor && (
                      <div className="p-2 bg-primary/15 rounded-lg border border-primary/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            You are
                          </span>
                          <span className="text-xs font-bold text-primary capitalize px-2 py-1 bg-primary/20 rounded">
                            {currentPlayerColor}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <div className="flex-1 min-h-0">
                  <GameControls />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.6 }}
                className="flex-1 flex flex-col h-full items-center"
              >
                <div className="flex flex-col h-full max-w-[600px] mx-auto w-full">
                  <div className="mb-3 flex-shrink-0 scale-90 origin-center">
                    <PlayerTime
                      color={TopPlayerColor}
                      playerName={
                        TopPlayer?.name ||
                        (TopPlayerColor === "white"
                          ? "White Player"
                          : "Black Player")
                      }
                    />
                  </div>
                  <div className="flex-1 flex items-center justify-center min-h-0">
                    <div className="aspect-square w-full max-w-[500px] max-h-[500px]">
                      <ChessBoard boardOrientation={boardOrientation} />
                    </div>
                  </div>
                  <div className="mt-3 flex-shrink-0 scale-90 origin-center">
                    <PlayerTime
                      color={BottomPlayerColor}
                      playerName={
                        BottomPlayer?.name ||
                        (BottomPlayerColor === "white"
                          ? "White Player"
                          : "Black Player")
                      }
                    />
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4, duration: 0.6 }}
                className="hidden xl:flex w-full max-w-xs flex-col h-full space-y-4"
              >
                <div className="h-[400px] min-h-[200px]">
                  <MoveHistory moves={currentGame.moveHistory} />
                </div>
                <div className="h-[400px] min-h-[200px]">
                  <GameChat />
                </div>
              </motion.div>

              <div className="xl:hidden flex flex-col space-y-4">
                <Card className="glass border-white/10">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center text-base">
                      <Crown className="w-4 h-4 mr-2 text-chess-gold" />
                      Game Info
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-white/5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Status
                      </span>
                      <span className="text-xs font-bold capitalize text-chess-gold px-2 py-1 bg-chess-gold/10 rounded">
                        {currentGame.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-white/5">
                      <span className="text-xs font-medium text-muted-foreground">
                        Turn
                      </span>
                      <span className="text-xs font-semibold flex items-center">
                        <div
                          className={`w-3 h-3 rounded-full mr-1.5 border ${
                            currentTurn === "w"
                              ? "bg-white border-gray-400"
                              : "bg-gray-900 border-gray-600"
                          }`}
                        />
                        {currentTurn === "w" ? "White" : "Black"}
                      </span>
                    </div>
                    {currentPlayerColor && (
                      <div className="p-2 bg-primary/15 rounded-lg border border-primary/30">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-medium text-muted-foreground">
                            You are
                          </span>
                          <span className="text-xs font-bold text-primary capitalize px-2 py-1 bg-primary/20 rounded">
                            {currentPlayerColor}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
                <GameControls />
                <MoveHistory moves={currentGame.moveHistory} />
                <GameChat />
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      <PromotionModal
        isOpen={isPromotionOpen}
        onSelectPromotion={handleSelectPromotion}
        onCancel={handleCancelPromotion}
      />
      <GameEndModal
        isOpen={endModalOpen}
        result={endResult}
        reasonMessage={endReasonMessage}
        onClose={handleEndModalClose}
        onPlayAgain={handlePlayAgain}
      />
    </div>
  );
};

export default GameRoom;
