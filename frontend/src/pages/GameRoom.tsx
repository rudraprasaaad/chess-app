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
    <div className="h-screen bg-background overflow-hidden">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
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
        <div className="absolute inset-0 chess-pattern opacity-[0.02]" />
      </div>

      {/* Navigation */}
      <Navbar />

      {/* Main Game Layout - Reduced navbar height and moved up */}
      <div className="relative z-10 h-[calc(100vh-64px)] overflow-hidden flex justify-center">
        <div className="w-[90%] max-w-7xl h-full px-3 py-2">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full"
          >
            {/* Desktop Layout (1200px+) */}
            <div className="hidden xl:block h-full">
              <div className="grid grid-cols-12 gap-6 h-full">
                {/* Left Sidebar - Game Info & Controls */}
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.2, duration: 0.6 }}
                  className="col-span-3 space-y-4 overflow-y-auto"
                >
                  {/* Game Info Card - Compact */}
                  <Card className="glass border-white/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center text-base">
                        <Crown className="w-4 h-4 mr-2 text-chess-gold" />
                        Game Info
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-white/5">
                          <span className="text-xs font-medium text-muted-foreground">
                            Status
                          </span>
                          <span className="text-xs font-bold capitalize text-chess-gold px-2 py-1 bg-chess-gold/10 rounded">
                            {game.status}
                          </span>
                        </div>

                        <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg border border-white/5">
                          <span className="text-xs font-medium text-muted-foreground">
                            Turn
                          </span>
                          <span className="text-xs font-semibold flex items-center">
                            <div
                              className={`w-3 h-3 rounded-full mr-1.5 border ${
                                game.fen.split(" ")[1] === "w"
                                  ? "bg-white border-gray-400"
                                  : "bg-gray-900 border-gray-600"
                              }`}
                            />
                            {game.fen.split(" ")[1] === "w" ? "White" : "Black"}
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
                      </div>
                    </CardContent>
                  </Card>

                  {/* Game Controls */}
                  <GameControls />
                </motion.div>

                {/* Center - Game Board Area with Proper Layout */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3, duration: 0.6 }}
                  className="col-span-6 flex flex-col h-full py-4"
                >
                  <div className="flex flex-col h-full max-w-[500px] mx-auto w-full">
                    {/* Black Player Timer - Slightly Reduced Height */}
                    <div className="mb-3 flex-shrink-0 scale-90 origin-center">
                      <PlayerTime
                        color="black"
                        playerName={blackPlayer?.userId || "Black Player"}
                        isCurrentPlayer={game.fen.split(" ")[1] === "b"}
                      />
                    </div>

                    {/* Chess Board Container - Centered and Properly Sized */}
                    <div className="flex-1 flex items-center justify-center min-h-0">
                      <div className="aspect-square w-full max-w-[450px] max-h-[450px]">
                        <ChessBoard />
                      </div>
                    </div>

                    {/* White Player Timer - Slightly Reduced Height */}
                    <div className="mt-3 flex-shrink-0 scale-90 origin-center">
                      <PlayerTime
                        color="white"
                        playerName={whitePlayer?.userId || "White Player"}
                        isCurrentPlayer={game.fen.split(" ")[1] === "w"}
                      />
                    </div>
                  </div>
                </motion.div>

                {/* Right Sidebar - Move History & Chat */}
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4, duration: 0.6 }}
                  className="col-span-3 flex flex-col space-y-4 h-full"
                >
                  <div className="flex-1 min-h-0">
                    <MoveHistory moves={game.moveHistory} />
                  </div>
                  <div className="flex-1 min-h-0">
                    <GameChat />
                  </div>
                </motion.div>
              </div>
            </div>

            {/* Tablet Layout (768px - 1199px) */}
            <div className="hidden md:block xl:hidden h-full">
              <div className="space-y-4 h-full flex flex-col">
                {/* Top Section - Black Player Timer - Slightly Reduced */}
                <div className="flex-shrink-0 scale-90 origin-center">
                  <PlayerTime
                    color="black"
                    playerName={blackPlayer?.userId || "Black Player"}
                    isCurrentPlayer={game.fen.split(" ")[1] === "b"}
                  />
                </div>

                {/* Middle Section - Board and Side Info */}
                <div className="flex-1 grid grid-cols-5 gap-6 min-h-0">
                  {/* Left - Game Info */}
                  <div className="col-span-2 space-y-4">
                    <Card className="glass border-white/10">
                      <CardHeader className="pb-2">
                        <CardTitle className="flex items-center text-sm">
                          <Crown className="w-4 h-4 mr-2 text-chess-gold" />
                          Game Info
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="grid grid-cols-1 gap-2">
                          <div className="p-2 bg-muted/50 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">
                              Status
                            </div>
                            <div className="text-xs font-medium text-chess-gold capitalize">
                              {game.status}
                            </div>
                          </div>
                          <div className="p-2 bg-muted/50 rounded-lg">
                            <div className="text-xs text-muted-foreground mb-1">
                              Turn
                            </div>
                            <div className="text-xs font-medium flex items-center">
                              <div
                                className={`w-2 h-2 rounded-full mr-1 ${
                                  game.fen.split(" ")[1] === "w"
                                    ? "bg-white border border-gray-300"
                                    : "bg-gray-800"
                                }`}
                              />
                              {game.fen.split(" ")[1] === "w"
                                ? "White"
                                : "Black"}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                    <GameControls />
                  </div>

                  {/* Center - Chess Board - Better Positioning */}
                  <div className="col-span-3 flex items-center justify-center p-2">
                    <div className="aspect-square w-full max-w-[400px] max-h-[400px]">
                      <ChessBoard />
                    </div>
                  </div>
                </div>

                {/* Bottom Sections */}
                <div className="space-y-4 flex-shrink-0">
                  {/* White Player Timer - Slightly Reduced */}
                  <div className="scale-90 origin-center">
                    <PlayerTime
                      color="white"
                      playerName={whitePlayer?.userId || "White Player"}
                      isCurrentPlayer={game.fen.split(" ")[1] === "w"}
                    />
                  </div>

                  {/* Bottom Grid - Move History & Chat */}
                  <div className="grid grid-cols-2 gap-4 h-64">
                    <MoveHistory moves={game.moveHistory} />
                    <GameChat />
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile Layout */}
            <div className="md:hidden h-full flex flex-col space-y-3 overflow-y-auto">
              {/* Black Player Timer - Slightly Reduced */}
              <div className="flex-shrink-0 scale-90 origin-center">
                <PlayerTime
                  color="black"
                  playerName={blackPlayer?.userId || "Black Player"}
                  isCurrentPlayer={game.fen.split(" ")[1] === "b"}
                />
              </div>

              {/* Chess Board - Better Mobile Sizing */}
              <div className="flex-shrink-0 px-2">
                <div className="aspect-square w-full max-w-[350px] mx-auto">
                  <ChessBoard />
                </div>
              </div>

              {/* White Player Timer - Slightly Reduced */}
              <div className="flex-shrink-0 scale-90 origin-center">
                <PlayerTime
                  color="white"
                  playerName={whitePlayer?.userId || "White Player"}
                  isCurrentPlayer={game.fen.split(" ")[1] === "w"}
                />
              </div>

              {/* Game Info Compact */}
              <Card className="glass border-white/10 mx-4 flex-shrink-0">
                <CardContent className="p-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">
                        Status
                      </div>
                      <div className="text-xs font-bold text-chess-gold capitalize">
                        {game.status}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-muted/50 rounded-lg">
                      <div className="text-xs text-muted-foreground mb-1">
                        Turn
                      </div>
                      <div className="text-xs font-semibold">
                        {game.fen.split(" ")[1] === "w" ? "White" : "Black"}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Controls */}
              <div className="px-4 flex-shrink-0">
                <GameControls />
              </div>

              {/* Move History & Chat */}
              <div className="space-y-4 px-4 flex-1 min-h-0">
                <div className="h-48">
                  <MoveHistory moves={game.moveHistory} />
                </div>
                <div className="h-48">
                  <GameChat />
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Modals */}
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
    </div>
  );
};

export default GameRoom;
