import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useRoomStore } from "../store/room";
import { Room, RoomWithGame } from "../types/room";
import { useAuthStore } from "../store/auth";
import { toast } from "sonner";
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
import { Navbar } from "../components/shared/Navbar";

function isRoomWithGame(
  room: Room | RoomWithGame | null
): room is RoomWithGame {
  return !!room && "game" in room && room.game !== null;
}

const GameRoom = () => {
  const navigate = useNavigate();

  const isPromotionOpen = useGameStore((state) => state.isPromotionModalOpen);
  const submitPromotion = useGameStore((state) => state.submitPromotion);
  const cancelPromotion = useGameStore((state) => state.cancelPromotion);
  const currentRoom = useRoomStore((state) => state.currentRoom);
  const joinQueue = useRoomStore((state) => state.joinQueue);

  const { user } = useAuthStore();

  const game = isRoomWithGame(currentRoom) ? currentRoom.game : null;
  const { gameId } = useParams<{ gameId: string }>();

  const [endModalOpen, setModalOpen] = useState(false);
  const [endResult, setEndResult] = useState<
    "win" | "loss" | "draw" | "timeout" | "resign" | null
  >(null);
  const [endReasonMessage, setEndReasonMessage] = useState<string | undefined>(
    undefined
  );
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!game || game.id !== gameId) {
      hasRedirected.current = true;
      toast.error("Game not found or not active. Redirecting to lobby.");
      navigate("/lobby");
      return;
    }

    if (
      game?.status === GameStatus.COMPLETED ||
      game?.status === GameStatus.DRAW ||
      game?.status === GameStatus.ABANDONED
    ) {
      setModalOpen(true);
      const userId = user?.id;
      let res: typeof endResult = "draw";

      if (game.status === GameStatus.DRAW) {
        res = "draw";
        setEndReasonMessage("Game ended in Draw.");
      } else if (game.status === GameStatus.COMPLETED) {
        if (game.winnerId === userId) res = "win";
        else if (game.winnerId) res = "loss";
        else res = "loss";

        setEndReasonMessage(
          res === "win" ? "You won the game!" : "You lost the game."
        );
      } else if (game.status === GameStatus.ABANDONED) {
        res = "resign";
        setEndReasonMessage("Game abandoned due to disconnection.");
      }
      setEndResult(res);
    } else {
      setModalOpen(false);
      setEndResult(null);
      setEndReasonMessage(undefined);
    }
  }, [game, gameId, navigate, user]);

  const handleEndModalClose = () => {
    setModalOpen(false);
    navigate("/lobby");
  };

  const handlePlayAgain = () => {
    joinQueue(true);
    setModalOpen(false);
  };

  if (!game || game.id !== gameId) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center glass p-8 rounded-xl"
        >
          <div className="w-12 h-12 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-lg font-heading text-foreground">
            Loading game...
          </p>
        </motion.div>
      </div>
    );
  }

  const whitePlayer = game.players.find((p) => p.color === "white");
  const blackPlayer = game.players.find((p) => p.color === "black");

  const currentPlayerColor = game.players.find(
    (p) => p.userId === user?.id
  )?.color;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <Navbar />

      <PromotionModal
        isOpen={isPromotionOpen}
        onSelectPromotion={submitPromotion}
        onCancel={cancelPromotion}
      />

      <GameEndModal
        isOpen={endModalOpen}
        result={endResult}
        reasonMessage={endReasonMessage}
        onClose={handleEndModalClose}
        onPlayAgain={handlePlayAgain}
      />

      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          className="absolute -top-40 -right-40 w-80 h-80 bg-primary/5 rounded-full blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-80 h-80 bg-chess-gold/5 rounded-full blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.5, 0.3, 0.5],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-96 h-96 bg-accent/3 rounded-full blur-3xl"
          animate={{
            rotate: [0, 360],
            scale: [1, 1.1, 1],
          }}
          transition={{
            duration: 15,
            repeat: Infinity,
            ease: "linear",
          }}
        />
      </div>

      <div className="absolute inset-0 chess-pattern opacity-[0.03]" />

      <div className="relative z-10 p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="grid grid-cols-1 lg:grid-cols-4 gap-6"
          >
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="lg:col-span-1 space-y-4"
            >
              <Card className="glass border-white/10">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center text-lg">
                    <Crown className="w-5 h-5 mr-2 text-chess-gold" />
                    Game Info
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">
                      Status
                    </span>
                    <span className="text-sm font-medium capitalize text-chess-gold">
                      {game.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <span className="text-sm text-muted-foreground">Turn</span>
                    <span className="text-sm font-medium flex items-center">
                      <div
                        className={`w-3 h-3 rounded-full mr-2 ${
                          game.fen.split(" ")[1] === "w"
                            ? "bg-white border border-gray-300"
                            : "bg-gray-800"
                        }`}
                      />
                      {game.fen.split(" ")[1] === "w" ? "White" : "Black"}
                    </span>
                  </div>
                  {currentPlayerColor && (
                    <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg border border-primary/20">
                      <span className="text-sm text-muted-foreground">
                        You are
                      </span>
                      <span className="text-sm font-medium text-primary capitalize">
                        {currentPlayerColor}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              <GameControls />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="lg:col-span-2"
            >
              <div className="flex flex-col items-center space-y-4">
                <div className="w-full max-w-md">
                  <PlayerTime
                    color="black"
                    playerName={blackPlayer?.userId || "Black Player"}
                    isCurrentPlayer={game.fen.split(" ")[1] === "b"}
                  />
                </div>

                <div className="flex justify-center">
                  <ChessBoard />
                </div>

                <div className="w-full max-w-md">
                  <PlayerTime
                    color="white"
                    playerName={whitePlayer?.userId || "White Player"}
                    isCurrentPlayer={game.fen.split(" ")[1] === "w"}
                  />
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="lg:col-span-1"
            >
              <MoveHistory moves={game.moveHistory} />
              <GameChat />
            </motion.div>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default GameRoom;
