/* eslint-disable @typescript-eslint/no-explicit-any */
import { memo, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useRoomStore } from "../store/room";
import { useGameStore } from "../store/game";
import { GameStatus, RoomType } from "../types/common";
import { useRoomByInviteCode } from "../hooks/api/useRoom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Computer, Crown, Zap, Plus, Coffee, Trophy, Key } from "lucide-react";
import { Navbar } from "../components/shared/Navbar";

const Lobby = () => {
  const navigate = useNavigate();
  const {
    isJoiningRoom,
    isCreatingRoom,
    joinRoom,
    createRoom,
    joinQueue,
    leaveQueue,
    error,
    isInQueue,
  } = useRoomStore();

  const startBotGame = useGameStore((state) => state.startBotGame);
  const currentGame = useGameStore((state) => state.currentGame);

  const [createInviteCode, setCreateInviteCode] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState("");

  const { isLoading: isLookingUp, refetch } = useRoomByInviteCode(
    joinInviteCode,
    false
  );

  useEffect(() => {
    if (currentGame && currentGame.status === GameStatus.ACTIVE) {
      const targetPath = `/game/${currentGame.id}`;
      if (window.location.pathname !== targetPath) {
        navigate(targetPath);
      }
    }
  }, [currentGame, navigate]);

  useEffect(() => {
    if (error) toast.error(error);
  }, [error]);

  const handleCreateRoom = useCallback(() => {
    if (!createInviteCode.trim()) {
      toast.error("Please enter a valid invite code.");
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
      toast.error("Please enter an invite code to join.");
      return;
    }
    try {
      const result = await refetch();
      if (!result.data?.id) {
        toast.error("Room not found or invite code is invalid.");
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

  const handlePlayBot = useCallback(() => {
    startBotGame();
  }, [startBotGame]);

  return (
    <div className="h-screen bg-background grain relative overflow-hidden flex flex-col">
      <Navbar />

      <div className="absolute inset-0 pointer-events-none"></div>

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
                Choose how you want to play
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
                onClick={handlePlayBot}
                className="w-full h-11 justify-between bg-primary/10 border-primary/30 text-primary hover:bg-primary/20"
                variant="outline"
                disabled={isJoiningRoom || isCreatingRoom || isLookingUp}
              >
                <div className="flex items-center">
                  <Computer className="w-4 h-4 mr-3" />
                  Play with Computer
                </div>
                <span className="text-xs text-muted-foreground">Practice</span>
              </Button>
            </motion.div>

            <div className="flex items-center justify-center py-3">
              <div className="h-px bg-border flex-1" />
              <span className="px-3 text-xs text-muted-foreground font-medium">
                PLAY WITH OTHERS
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
                  disabled={isJoiningRoom || isCreatingRoom || isLookingUp}
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
                  disabled={isJoiningRoom || isCreatingRoom || isLookingUp}
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
                    Finding opponent
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we match you with a player...
                  </p>
                </div>
                <Button onClick={handleLeaveQueue} variant="outline" size="sm">
                  Cancel Search
                </Button>
              </motion.div>
            )}

            <div className="flex items-center justify-center py-3">
              <div className="h-px bg-border flex-1" />
              <span className="px-3 text-xs text-muted-foreground font-medium">
                PRIVATE ROOM
              </span>
              <div className="h-px bg-border flex-1" />
            </div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                onClick={() => setShowCreateModal(true)}
                className="w-full h-11 justify-between"
                disabled={isJoiningRoom || isCreatingRoom || isLookingUp}
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
                placeholder="Enter invite code to join"
                value={joinInviteCode}
                onChange={(e) => setJoinInviteCode(e.target.value)}
                disabled={isJoiningRoom || isCreatingRoom || isLookingUp}
                className="h-11"
              />
              <Button
                onClick={handleJoinRoom}
                variant="outline"
                className="w-full h-11 justify-between"
                disabled={isJoiningRoom || isCreatingRoom || isLookingUp}
              >
                <div className="flex items-center">
                  <Key className="w-4 h-4 mr-3" />
                  {isLookingUp ? "Verifying code..." : "Join with Code"}
                </div>
                {isLookingUp && (
                  <div className="w-4 h-4 border-2 border-foreground border-t-transparent rounded-full animate-spin" />
                )}
              </Button>
            </motion.div>
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
                    placeholder="e.g., my-secret-game"
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
