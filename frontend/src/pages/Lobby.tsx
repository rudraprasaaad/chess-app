/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useRoomStore, useQueueCountdown } from "../store/room";
import { useWebSocketStore } from "../store/websocket";
import { RoomStatus, RoomType } from "../types/common";
import { useRoomByInviteCode } from "../hooks/api/useRoom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Crown,
  Zap,
  Plus,
  Coffee,
  Trophy,
  Key,
  Sparkles,
  Bot,
} from "lucide-react";
import { Navbar } from "../components/shared/Navbar";
import FloatingChessPiece from "../components/game/FloatingChessPiece";

const sparkleAnimation = {
  scale: [0, 1, 0],
  opacity: [0, 1, 0],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

function isRoomWithGame(room: any): room is { game: { id: string } } {
  return (
    !!room &&
    typeof room === "object" &&
    "game" in room &&
    room.game !== null &&
    typeof room.game.id === "string"
  );
}

const Lobby = () => {
  const navigate = useNavigate();
  const { sendMessage } = useWebSocketStore();
  const {
    currentRoom,
    isJoiningRoom,
    isCreatingRoom,
    joinRoom,
    createRoom,
    joinQueue,
    leaveQueue,
    error,
    isInQueue,
  } = useRoomStore();

  const timeLeft = useQueueCountdown();

  const [createInviteCode, setCreateInviteCode] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState("");

  const { isLoading: isLookinUp, refetch } = useRoomByInviteCode(
    joinInviteCode,
    false
  );

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  useEffect(() => {
    if (
      currentRoom &&
      currentRoom.status === RoomStatus.ACTIVE &&
      isRoomWithGame(currentRoom)
    ) {
      const currentPath = window.location.pathname;
      const targetPath = `/game/${currentRoom.game.id}`;
      if (currentPath !== targetPath) navigate(targetPath);
    }
  }, [currentRoom, navigate]);

  const handleCreateRoom = useCallback(() => {
    if (!createInviteCode.trim()) {
      toast.error("Please enter a valid invite code for the private room.");
      return;
    }
    createRoom({
      type: RoomType.PRIVATE,
      inviteCode: createInviteCode.trim(),
    });
    setShowCreateModal(false);
    setCreateInviteCode("");
  }, [createInviteCode, createRoom]);

  const handleJoinRoom = useCallback(async () => {
    if (!joinInviteCode.trim()) {
      toast.error("Please enter the invite code to join the room.");
      return;
    }
    try {
      const result = await refetch();
      if (!result.data.id) {
        toast.error("Room not found or invite code invalid");
        return;
      }
      joinRoom({
        roomId: result.data.id,
        inviteCode: joinInviteCode.trim(),
      });
    } catch {
      toast.error("Failed to join room. Please try again.");
    }
  }, [joinInviteCode, refetch, joinRoom]);

  const handleQueue = useCallback(
    (isGuest: boolean) => {
      joinQueue(isGuest);
    },
    [joinQueue]
  );

  const handleLeaveQueue = useCallback(() => {
    leaveQueue();
  }, [leaveQueue]);

  const handlePlayWithBot = useCallback(() => {
    toast.info("Starting a game against the computer...");
    sendMessage({ type: "CREATE_BOT_GAME", payload: {} });
  }, [sendMessage]);

  return (
    <div className="h-screen bg-background grain relative overflow-hidden flex flex-col">
      <Navbar />

      <div className="absolute inset-0 pointer-events-none">
        <FloatingChessPiece
          piece="king"
          className="absolute top-1/4 left-1/4 w-8 h-8 text-muted-foreground/30"
          delay={0}
        />
        <FloatingChessPiece
          piece="queen"
          className="absolute top-1/3 right-1/4 w-6 h-6 text-muted-foreground/20"
          delay={2}
        />
        <FloatingChessPiece
          piece="rook"
          className="absolute bottom-1/3 left-1/6 w-7 h-7 text-muted-foreground/25"
          delay={4}
        />
        <FloatingChessPiece
          piece="bishop"
          className="absolute bottom-1/4 right-1/3 w-5 h-5 text-muted-foreground/15"
          delay={1}
        />
        <FloatingChessPiece
          piece="knight"
          className="absolute top-1/2 left-1/12 w-6 h-6 text-muted-foreground/20"
          delay={3}
        />
        <FloatingChessPiece
          piece="pawn"
          className="absolute top-2/3 right-1/6 w-4 h-4 text-muted-foreground/10"
          delay={5}
        />
        <motion.div
          className="absolute inset-0 opacity-[0.02]"
          animate={{ opacity: [0.01, 0.03, 0.01] }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut" as const,
          }}
        >
          <div className="absolute inset-0">
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i}>
                <div
                  className="absolute w-full h-px bg-foreground"
                  style={{ top: `${i * 8.33}%` }}
                />
                <div
                  className="absolute h-full w-px bg-foreground"
                  style={{ left: `${i * 8.33}%` }}
                />
              </div>
            ))}
          </div>
        </motion.div>
        {Array.from({ length: 8 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={sparkleAnimation}
            transition={{ delay: i * 0.8, duration: 4, repeat: Infinity }}
          >
            <Sparkles className="w-2 h-2 text-muted-foreground/10" />
          </motion.div>
        ))}
        <motion.div
          className="absolute top-1/4 right-1/4 w-32 h-32 rounded-full bg-gradient-to-br from-primary/5 to-transparent blur-xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut" as const,
          }}
        />
        <motion.div
          className="absolute bottom-1/3 left-1/3 w-24 h-24 rounded-full bg-gradient-to-br from-accent/5 to-transparent blur-xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.2, 0.5, 0.2] }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut" as const,
            delay: 2,
          }}
        />
      </div>

      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md space-y-6"
        >
          <div className="text-center space-y-3">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-card border"
            >
              <Crown className="w-7 h-7 text-foreground" />
            </motion.div>
            <div>
              <h1 className="text-2xl font-heading font-semibold text-foreground mb-1">
                Chess Lobby
              </h1>
              <p className="text-sm text-muted-foreground">
                Choose your game mode and start playing
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Button
                onClick={handlePlayWithBot}
                className="w-full h-11 justify-between bg-primary/90 hover:bg-primary"
                disabled={
                  isCreatingRoom || isJoiningRoom || isLookinUp || isInQueue
                }
              >
                <div className="flex items-center">
                  <Bot className="w-4 h-4 mr-3" />
                  Play vs. Computer
                </div>
                <span className="text-xs text-primary-foreground/80">
                  Practice
                </span>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                onClick={() => setShowCreateModal(true)}
                className="w-full h-11 justify-between"
                disabled={
                  isCreatingRoom || isJoiningRoom || isLookinUp || isInQueue
                }
              >
                <div className="flex items-center">
                  <Plus className="w-4 h-4 mr-3" />
                  Create Private Room
                </div>
              </Button>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-2"
            >
              <Input
                placeholder="Enter invite code"
                value={joinInviteCode}
                onChange={(e) => setJoinInviteCode(e.target.value)}
                disabled={
                  isJoiningRoom || isCreatingRoom || isLookinUp || isInQueue
                }
                className="h-11"
              />
              <Button
                onClick={handleJoinRoom}
                variant="outline"
                className="w-full h-11 justify-between"
                disabled={
                  isJoiningRoom || isCreatingRoom || isLookinUp || isInQueue
                }
              >
                <div className="flex items-center">
                  <Key className="w-4 h-4 mr-3" />
                  {isLookinUp ? "Finding room..." : "Join with Code"}
                </div>
                {isLookinUp && (
                  <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                )}
              </Button>
            </motion.div>

            <div className="flex items-center justify-center py-3">
              <div className="h-px bg-border flex-1" />
              <span className="px-3 text-xs text-muted-foreground font-medium">
                QUICK MATCH
              </span>
              <div className="h-px bg-border flex-1" />
            </div>

            {!isInQueue ? (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="grid gap-2"
              >
                <Button
                  onClick={() => handleQueue(true)}
                  variant="outline"
                  className="w-full h-11 justify-between"
                  disabled={isJoiningRoom || isCreatingRoom || isLookinUp}
                >
                  <div className="flex items-center">
                    <Coffee className="w-4 h-4 mr-3" />
                    Play as Guest
                  </div>
                  <span className="text-xs text-muted-foreground">Casual</span>
                </Button>
                <Button
                  onClick={() => handleQueue(false)}
                  variant="secondary"
                  className="w-full h-11 justify-between"
                  disabled={isJoiningRoom || isCreatingRoom || isLookinUp}
                >
                  <div className="flex items-center">
                    <Trophy className="w-4 h-4 mr-3" />
                    Ranked Match
                  </div>
                  <span className="text-xs text-muted-foreground">
                    Competitive
                  </span>
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-6 space-y-3"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary text-primary-foreground">
                  <Zap className="w-6 h-6 animate-pulse" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-1">
                    Finding opponent...
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we match you with a player. Time left:{" "}
                    <span className="font-semibold text-foreground">
                      {timeLeft}s
                    </span>
                  </p>
                </div>
                <Button onClick={handleLeaveQueue} variant="outline" size="sm">
                  Cancel
                </Button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="relative bg-card border rounded-xl p-6 w-full max-w-sm shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-secondary mb-3">
                  <Key className="w-6 h-6 text-secondary-foreground" />
                </div>
                <h2 className="text-xl font-heading font-semibold text-foreground">
                  Create Private Room
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Set a secret code for your opponent to join.
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-2">
                    Invite Code
                  </label>
                  <Input
                    placeholder="Enter custom invite code"
                    value={createInviteCode}
                    onChange={(e) => setCreateInviteCode(e.target.value)}
                    disabled={isCreatingRoom}
                    maxLength={20}
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setShowCreateModal(false)}
                    disabled={isCreatingRoom}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleCreateRoom}
                    disabled={isCreatingRoom}
                    className="flex-1"
                  >
                    {isCreatingRoom ? (
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                    ) : (
                      "Create"
                    )}
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(Lobby);
