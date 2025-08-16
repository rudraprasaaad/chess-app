import { AnimatePresence, motion } from "framer-motion";
import { Clock, Flag, Handshake, Trophy, Crown, Swords } from "lucide-react";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Button } from "../ui/button";
import { memo } from "react";

type GameResultType = "win" | "loss" | "draw" | "timeout" | "resign";

interface GameEndModalProps {
  isOpen: boolean;
  result: GameResultType | null;
  reasonMessage?: string;
  onClose: () => void;
  onPlayAgain: () => void;
}

const GameEndModal = ({
  isOpen,
  result,
  reasonMessage,
  onClose,
  onPlayAgain,
}: GameEndModalProps) => {
  if (!result) return null;

  const getResultConfig = () => {
    switch (result) {
      case "win":
        return {
          icon: <Crown className="w-16 h-16" />,
          title: "Victory!",
          subtitle: "Congratulations!",
          color: "text-chess-gold",
          bgColor: "bg-chess-gold/10",
          borderColor: "border-chess-gold/30",
        };
      case "draw":
        return {
          icon: <Handshake className="w-16 h-16" />,
          title: "Draw",
          subtitle: "Good game!",
          color: "text-muted-foreground",
          bgColor: "bg-muted/10",
          borderColor: "border-muted/30",
        };
      case "loss":
        return {
          icon: <Swords className="w-16 h-16" />,
          title: "Defeat",
          subtitle: "Better luck next time",
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          borderColor: "border-destructive/30",
        };
      case "timeout":
        return {
          icon: <Clock className="w-16 h-16" />,
          title: "Time Out",
          subtitle: "Time ran out",
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          borderColor: "border-destructive/30",
        };
      case "resign":
        return {
          icon: <Flag className="w-16 h-16" />,
          title: "Resigned",
          subtitle: "Game ended",
          color: "text-destructive",
          bgColor: "bg-destructive/10",
          borderColor: "border-destructive/30",
        };
      default:
        return {
          icon: <Trophy className="w-16 h-16" />,
          title: "Game Over",
          subtitle: "",
          color: "text-foreground",
          bgColor: "bg-muted/10",
          borderColor: "border-muted/30",
        };
    }
  };

  const config = result ? getResultConfig() : null;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/80 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ scale: 0.7, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.7, opacity: 0, y: 50 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
              duration: 0.5,
            }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="gameEndModalTitle"
          >
            <Card
              className={`glass max-w-md w-full border-white/10 ${config?.borderColor} overflow-hidden`}
            >
              <motion.div
                className={`absolute inset-0 ${config?.bgColor} opacity-50`}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.2, duration: 0.6 }}
              />

              <motion.div
                className="relative z-10"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.4 }}
              >
                <CardHeader className="text-center space-y-4 pb-6">
                  <motion.div
                    className={`flex justify-center ${config?.color}`}
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      delay: 0.4,
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                    }}
                  >
                    {config?.icon}
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                  >
                    <h2
                      id="gameEndModalTitle"
                      className={`text-4xl font-bold ${config?.color}`}
                    >
                      {config?.title}
                    </h2>
                    {config?.subtitle && (
                      <p className="text-muted-foreground mt-2 text-lg">
                        {config.subtitle}
                      </p>
                    )}
                  </motion.div>
                </CardHeader>

                {reasonMessage && (
                  <motion.div
                    className="px-6 pb-4"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                  >
                    <p className="text-muted-foreground text-center text-sm bg-muted/20 rounded-lg p-3 border border-white/5">
                      {reasonMessage}
                    </p>
                  </motion.div>
                )}

                <CardContent className="pt-0">
                  <motion.div
                    className="flex gap-3 justify-center"
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.7, duration: 0.4 }}
                  >
                    <Button
                      variant="outline"
                      onClick={onClose}
                      className="flex-1 hover:scale-105 transition-all duration-200"
                    >
                      Back to Lobby
                    </Button>
                    <Button
                      onClick={onPlayAgain}
                      className="flex-1 hover:scale-105 transition-all duration-200"
                    >
                      Play Again
                    </Button>
                  </motion.div>
                </CardContent>
              </motion.div>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default memo(GameEndModal);
