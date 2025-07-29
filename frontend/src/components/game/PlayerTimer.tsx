import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, User, Crown, Zap } from "lucide-react";
import { cn } from "../../lib/utils";
import { Card, CardContent } from "../ui/card";

interface PlayerTimerProps {
  color: "white" | "black";
  playerName: string;
  isCurrentPlayer: boolean;
  timeRemaining?: number; // in seconds
  initialTime?: number; // in seconds
  increment?: number; // increment per move in seconds
}

const PlayerTimer = ({
  color,
  playerName,
  isCurrentPlayer,
  timeRemaining = 600, // Default 10 minutes
  initialTime = 600,
  increment = 0,
}: PlayerTimerProps) => {
  const [displayTime, setDisplayTime] = useState(timeRemaining);
  const [isLowTime, setIsLowTime] = useState(false);

  // Update display time when prop changes
  useEffect(() => {
    setDisplayTime(timeRemaining);
    setIsLowTime(timeRemaining < 60); // Warning when less than 1 minute
  }, [timeRemaining]);

  // Timer countdown effect
  useEffect(() => {
    if (!isCurrentPlayer || displayTime <= 0) return;

    const interval = setInterval(() => {
      setDisplayTime((prev) => {
        const newTime = Math.max(0, prev - 1);
        setIsLowTime(newTime < 60);
        return newTime;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isCurrentPlayer, displayTime]);

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const getTimeProgress = (): number => {
    return initialTime > 0 ? (displayTime / initialTime) * 100 : 100;
  };

  return (
    <motion.div
      animate={{
        scale: isCurrentPlayer ? 1.02 : 1,
      }}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className={cn("relative", color === "black" && "order-first")}
    >
      <Card
        className={cn(
          "glass border-white/10 transition-all duration-300",
          isCurrentPlayer && "glow-primary border-primary/30"
        )}
      >
        <CardContent className="p-4">
          {/* Background progress indicator */}
          <div className="absolute inset-0 rounded-lg overflow-hidden">
            <div
              className={cn(
                "h-full transition-all duration-1000 ease-linear bg-gradient-to-r",
                displayTime === 0 && "from-destructive/20 to-destructive/10",
                isLowTime &&
                  !displayTime &&
                  "from-yellow-500/20 to-yellow-500/10",
                isCurrentPlayer &&
                  displayTime > 60 &&
                  "from-primary/10 to-primary/5",
                !isCurrentPlayer &&
                  displayTime > 60 &&
                  "from-muted/10 to-muted/5"
              )}
              style={{ width: `${getTimeProgress()}%` }}
            />
          </div>

          <div className="relative z-10 flex items-center justify-between">
            {/* Player Info */}
            <div className="flex items-center space-x-3">
              <motion.div
                animate={{
                  scale: isCurrentPlayer ? [1, 1.1, 1] : 1,
                  boxShadow: isCurrentPlayer
                    ? "0 0 20px hsl(var(--primary) / 0.5)"
                    : "none",
                }}
                transition={{
                  duration: 2,
                  repeat: isCurrentPlayer ? Infinity : 0,
                  ease: "easeInOut",
                }}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border transition-all duration-300",
                  color === "white"
                    ? "bg-white/90 text-gray-900 border-white/50 shadow-lg"
                    : "bg-gray-900/90 text-white border-gray-600/50 shadow-lg",
                  isCurrentPlayer &&
                    "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
              >
                {color === "white" ? (
                  <Crown className="h-6 w-6" />
                ) : (
                  <User className="h-6 w-6" />
                )}
              </motion.div>

              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-heading font-semibold text-foreground capitalize">
                    {playerName}
                  </span>
                  {isCurrentPlayer && (
                    <motion.div
                      animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    >
                      <Zap className="h-4 w-4 text-chess-gold" />
                    </motion.div>
                  )}
                </div>
                <span className="text-sm text-muted-foreground font-medium">
                  Playing {color}
                </span>
              </div>
            </div>

            {/* Timer Display */}
            <div className="text-right">
              <motion.div
                animate={{
                  scale: isLowTime && isCurrentPlayer ? [1, 1.05, 1] : 1,
                }}
                transition={{
                  duration: 0.5,
                  repeat: isLowTime && isCurrentPlayer ? Infinity : 0,
                }}
                className={cn(
                  "flex items-center space-x-2 text-2xl font-mono font-bold transition-colors duration-300",
                  displayTime === 0 && "text-destructive",
                  isLowTime && displayTime > 0 && "text-yellow-500",
                  !isLowTime && "text-foreground"
                )}
              >
                <Clock className="h-5 w-5" />
                <span>{formatTime(displayTime)}</span>
              </motion.div>

              {increment > 0 && (
                <div className="text-xs text-muted-foreground mt-1 font-medium">
                  +{increment}s per move
                </div>
              )}
            </div>
          </div>

          {/* Active player indicator */}
          {isCurrentPlayer && (
            <motion.div
              initial={{ opacity: 0, scaleX: 0 }}
              animate={{ opacity: 1, scaleX: 1 }}
              className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary to-chess-gold origin-left"
            />
          )}

          {/* Time up overlay */}
          {displayTime === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-destructive/90 flex items-center justify-center backdrop-blur-sm rounded-lg"
            >
              <div className="text-center text-destructive-foreground">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <Clock className="h-8 w-8 mx-auto mb-2" />
                </motion.div>
                <span className="font-bold font-heading">Time's Up!</span>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default PlayerTimer;
