/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { useRoomStore } from "../store/room";
import { RoomStatus, RoomType } from "../types/common";
import { useRoomByInviteCode } from "../hooks/api/useRoom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import {
  Crown,
  Users,
  Zap,
  Plus,
  Coffee,
  Trophy,
  Key,
  Sparkles,
} from "lucide-react";
import { Navbar } from "../components/shared/Navbar";

// Animation properties
const floatingAnimation = {
  y: [-20, 20, -20],
  rotate: [-2, 2, -2],
  transition: {
    duration: 6,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

const sparkleAnimation = {
  scale: [0, 1, 0],
  opacity: [0, 1, 0],
  transition: {
    duration: 3,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

// Chess piece component
const FloatingChessPiece = ({
  piece,
  className,
  delay = 0,
}: {
  piece: string;
  className: string;
  delay?: number;
}) => {
  const pieces = {
    king: "M12 2L15 5H9L12 2ZM12 6C10 6 8 8 8 12V16H16V12C16 8 14 6 12 6Z",
    queen:
      "M12 2L14 6L18 4L16 8L20 10L16 12L18 16L14 14L12 18L10 14L6 16L8 12L4 10L8 8L6 4L10 6L12 2Z",
    rook: "M6 4H8V6H10V4H14V6H16V4H18V8H6V4ZM6 8H18V16H6V8Z",
    bishop: "M12 2C14 4 16 6 16 10V16H8V10C8 6 10 4 12 2Z",
    knight:
      "M8 16H16V14C16 10 14 8 12 8C10 8 8 10 8 14V16ZM12 2C14 4 16 6 14 8H10C8 6 10 4 12 2Z",
    pawn: "M12 4C13 4 14 5 14 6S13 8 12 8S10 7 10 6S11 4 12 4ZM10 10H14V16H10V10Z",
  };

  return (
    <motion.div
      className={className}
      animate={floatingAnimation}
      style={{ animationDelay: `${delay}s` }}
    >
      <svg
        className="w-full h-full opacity-20"
        viewBox="0 0 24 24"
        fill="currentColor"
      >
        <path d={pieces[piece as keyof typeof pieces]} />
      </svg>
    </motion.div>
  );
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

  const {
    currentRoom,
    isJoiningRoom,
    isCreatingRoom,
    joinRoom,
    createRoom,
    joinQueue,
    leaveQueue,
    error,
  } = useRoomStore();

  const [roomType, setRoomType] = useState<RoomType.PUBLIC | RoomType.PRIVATE>(
    RoomType.PUBLIC
  );
  const [createInviteCode, setCreateInviteCode] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinInviteCode, setJoinInviteCode] = useState("");
  const [isGuestQueue, setIsGuestQueue] = useState(false);

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
      navigate(`/game/${currentRoom.game.id}`);
    }
  }, [currentRoom, navigate]);

  const handleCreateRoom = () => {
    if (roomType === RoomType.PRIVATE && !createInviteCode.trim()) {
      toast.error("Please enter a valid invite code for private room.");
      return;
    }

    createRoom({
      type: roomType,
      inviteCode: roomType === RoomType.PRIVATE ? createInviteCode.trim() : "",
    });

    setShowCreateModal(false);
    setCreateInviteCode("");
  };

  const handleJoinRoom = async () => {
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
  };

  const handleQueue = (isGuest: boolean) => {
    setIsGuestQueue(isGuest);
    joinQueue(isGuest);
  };

  const handleLeaveQueue = () => {
    leaveQueue();
    setIsGuestQueue(false);
  };

  return (
    <div className="h-screen bg-background grain relative overflow-hidden flex flex-col">
      <Navbar />

      {/* Background decorations */}
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
          animate={{
            opacity: [0.01, 0.03, 0.01],
          }}
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
            transition={{
              delay: i * 0.8,
              duration: 4,
              repeat: Infinity,
            }}
          >
            <Sparkles className="w-2 h-2 text-muted-foreground/10" />
          </motion.div>
        ))}

        <motion.div
          className="absolute top-1/4 right-1/4 w-32 h-32 rounded-full bg-gradient-to-br from-primary/5 to-transparent blur-xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut" as const,
          }}
        />
        <motion.div
          className="absolute bottom-1/3 left-1/3 w-24 h-24 rounded-full bg-gradient-to-br from-accent/5 to-transparent blur-xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.5, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut" as const,
            delay: 2,
          }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-md space-y-6"
        >
          {/* Header */}
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

          {/* Controls */}
          <div className="space-y-3">
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Button
                onClick={() => setShowCreateModal(true)}
                className="w-full h-11 justify-between"
                disabled={isCreatingRoom || isJoiningRoom || isLookinUp}
              >
                <div className="flex items-center">
                  <Plus className="w-4 h-4 mr-3" />
                  Create Room
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
                disabled={isJoiningRoom || isCreatingRoom || isLookinUp}
                className="h-11"
              />
              <Button
                onClick={handleJoinRoom}
                variant="outline"
                className="w-full h-11 justify-between"
                disabled={isJoiningRoom || isCreatingRoom || isLookinUp}
              >
                <div className="flex items-center">
                  <Key className="w-4 h-4 mr-3" />
                  {isLookinUp ? "Finding room..." : "Join Private Room"}
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

            {!isGuestQueue ? (
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
                  <Zap className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-medium text-foreground mb-1">
                    Finding opponent
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Please wait while we match you with a player
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

      {/* Create Room Modal */}
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
                  <Plus className="w-6 h-6 text-secondary-foreground" />
                </div>
                <h2 className="text-xl font-heading font-semibold text-foreground">
                  Create Room
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Set up your chess match
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-foreground mb-3">
                    Room Type
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => setRoomType(RoomType.PUBLIC)}
                      className={`p-4 rounded-lg border text-center transition-colors ${
                        roomType === RoomType.PUBLIC
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-foreground/20"
                      }`}
                      disabled={isCreatingRoom}
                    >
                      <Users className="w-5 h-5 mx-auto mb-2" />
                      <span className="text-sm font-medium">Public</span>
                    </button>
                    <button
                      onClick={() => setRoomType(RoomType.PRIVATE)}
                      className={`p-4 rounded-lg border text-center transition-colors ${
                        roomType === RoomType.PRIVATE
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border hover:border-foreground/20"
                      }`}
                      disabled={isCreatingRoom}
                    >
                      <Key className="w-5 h-5 mx-auto mb-2" />
                      <span className="text-sm font-medium">Private</span>
                    </button>
                  </div>
                </div>

                <AnimatePresence>
                  {roomType === RoomType.PRIVATE && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                    >
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
                    </motion.div>
                  )}
                </AnimatePresence>

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

export default Lobby;
