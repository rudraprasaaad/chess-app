import {
  memo,
  useEffect as useEffectReact,
  useMemo,
  useRef,
  useState,
} from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Clock, Crown, Zap } from "lucide-react";
import { cn } from "../../lib/utils";
import { Card, CardContent } from "../ui/card";
import { useGameStore } from "../../store/game";

interface PlayerTimerProps {
  color: "white" | "black";
  playerName: string;
  isCurrentPlayer: boolean;
}

const PlayerTimer = ({
  color,
  playerName,
  isCurrentPlayer,
}: PlayerTimerProps) => {
  const whiteTimeLeft = useGameStore((s) => s.whiteTimeLeft);
  const blackTimeLeft = useGameStore((s) => s.blackTimeLeft);
  const initialTime = useGameStore(
    (s) => s.currentGame?.timeControl?.initial || 600
  );

  const displayTime = color === "white" ? whiteTimeLeft : blackTimeLeft;
  const isLowTime = displayTime < 60;

  const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const rawProgress = useMotionValue(1);
  const progressSpring = useSpring(rawProgress, {
    stiffness: 120,
    damping: 20,
    mass: 0.4,
  });

  useEffectReact(() => {
    const p =
      initialTime > 0 ? Math.max(0, Math.min(1, displayTime / initialTime)) : 0;
    rawProgress.set(p);
  }, [displayTime, initialTime, rawProgress]);

  const prevActiveRef = useRef<boolean>(false);
  const [pulse, setPulse] = useState(false);
  useEffectReact(() => {
    if (isCurrentPlayer && !prevActiveRef.current) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 800);
      return () => clearTimeout(t);
    }
    prevActiveRef.current = isCurrentPlayer;
  }, [isCurrentPlayer]);

  const PlayerIcon = useMemo(
    () =>
      color === "white" ? (
        <Crown className="h-6 w-6" />
      ) : (
        <Crown className="h-6 w-6" />
      ),
    [color]
  );

  return (
    <div className={cn("relative", color === "black" && "order-first")}>
      <Card
        className={cn(
          "glass border-white/10 transition-all duration-300",
          isCurrentPlayer && "glow-primary border-primary/30"
        )}
      >
        <CardContent className="p-4">
          <div className="absolute inset-0 rounded-lg overflow-hidden">
            <motion.div
              className={cn(
                "h-full origin-left bg-gradient-to-r",
                displayTime === 0 && "from-destructive/20 to-destructive/10",
                isLowTime &&
                  displayTime > 0 &&
                  "from-yellow-500/20 to-yellow-500/10",
                isCurrentPlayer && "from-primary/10 to-primary/5",
                !isCurrentPlayer && "from-muted/10 to-muted/5"
              )}
              style={{ scaleX: progressSpring }}
            />
          </div>

          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <motion.div
                animate={pulse ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className={cn(
                  "flex h-12 w-12 items-center justify-center rounded-full border shadow-lg transition-all duration-300",
                  color === "white"
                    ? "bg-white/90 text-gray-900 border-white/50"
                    : "bg-gray-900/90 text-white border-gray-600/50",
                  isCurrentPlayer &&
                    "ring-2 ring-primary ring-offset-2 ring-offset-background"
                )}
              >
                {PlayerIcon}
              </motion.div>

              <div>
                <div className="flex items-center space-x-2">
                  <span className="font-heading font-semibold text-foreground capitalize">
                    {playerName}
                  </span>
                  {isCurrentPlayer && (
                    <motion.div
                      key="bolt"
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ duration: 0.2 }}
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

            <div className="text-right">
              <div
                className={cn(
                  "flex items-center space-x-2 text-2xl font-mono font-bold",
                  displayTime === 0 && "text-destructive",
                  isLowTime && displayTime > 0 && "text-yellow-500",
                  !isLowTime && displayTime > 0 && "text-foreground"
                )}
              >
                <Clock className="h-5 w-5" />
                <span>{formatTime(displayTime)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default memo(PlayerTimer);
