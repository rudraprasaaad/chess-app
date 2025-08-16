import { memo, useCallback, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Check,
  Flag,
  Handshake,
  LogOut,
  Settings,
  XCircle,
} from "lucide-react";
import { Button } from "../ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { useNavigate } from "react-router-dom";
import { useGameStore } from "../../store/game";

const GameControls = () => {
  const [showConfirmResign, setShowConfirmResign] = useState(false);
  const [showConfirmDraw, setShowConfirmDraw] = useState(false);
  const navigate = useNavigate();

  const resignGame = useGameStore((state) => state.resignGame);
  const offerDraw = useGameStore((state) => state.offerDraw);
  const acceptDraw = useGameStore((state) => state.acceptDraw);
  const declineDraw = useGameStore((state) => state.declineDraw);
  const drawOffer = useGameStore((state) => state.drawOffer);
  const currentGame = useGameStore((state) => state.currentGame);

  const isGameActive = currentGame?.status === "ACTIVE";

  const handleResign = useCallback(() => {
    resignGame();
    setShowConfirmResign(false);
  }, [resignGame]);

  const handleOfferDraw = useCallback(() => {
    offerDraw();
    setShowConfirmDraw(false);
  }, [offerDraw]);

  const handleLeaveGame = useCallback(() => {
    if (isGameActive) {
      if (
        window.confirm(
          "The game is still active. Leaving will count as a resignation. Are you sure?"
        )
      ) {
        resignGame();
        navigate("/lobby");
      } else {
        toast.info("Cool!! You decided to stay in game.");
      }
    } else {
      navigate("/lobby");
    }
  }, [isGameActive, resignGame, navigate]);

  return (
    <Card className="glass border-white/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-lg">
          <Settings className="w-5 h-5 mr-2 text-chess-silver" />
          Game Controls
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <AnimatePresence mode="wait">
          {!showConfirmResign ? (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <Button
                variant="destructive"
                size="sm"
                className="w-full justify-start group hover:shadow-lg transition-all duration-300"
                onClick={() => setShowConfirmResign(true)}
                disabled={!isGameActive}
              >
                <Flag className="w-4 h-4 mr-2 group-hover:animate-pulse" />
                Resign
              </Button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center text-destructive">
                <AlertTriangle className="w-4 h-4 mr-2" />
                <span className="text-sm font-heading font-semibold">
                  Confirm Resignation
                </span>
              </div>

              <p className="text-xs text-muted-foreground leading-relaxed">
                Are you sure you want to resign? This will end the game and
                count as a loss.
              </p>

              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleResign}
                  className="flex-1 hover:shadow-lg transition-all duration-300"
                >
                  Yes, Resign
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowConfirmResign(false)}
                  className="flex-1 hover:bg-muted/50"
                >
                  Cancel
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence mode="wait">
          {!drawOffer ? (
            !showConfirmDraw ? (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, delay: 0.05 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start group hover:bg-primary/10 hover:border-primary/30 hover:text-primary transition-all duration-300"
                  onClick={() => setShowConfirmDraw(true)}
                  disabled={!isGameActive}
                >
                  <Handshake className="w-4 h-4 mr-2 group-hover:animate-bounce" />
                  Offer Draw
                </Button>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="bg-primary/10 border border-primary/30 rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center text-primary">
                  <Handshake className="w-4 h-4 mr-2" />
                  <span className="text-sm font-heading font-semibold">
                    Offer Draw
                  </span>
                </div>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  Send a draw offer to your opponent? The game will end in a
                  draw if they accept.
                </p>

                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleOfferDraw}
                    className="flex-1 hover:shadow-lg transition-all duration-300"
                  >
                    Send Offer
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowConfirmDraw(false)}
                    className="flex-1 hover:bg-muted/50"
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="bg-primary/10 border border-primary/30 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center text-primary">
                <Handshake className="w-4 h-4 mr-2" />
                <span className="text-sm font-heading font-semibold">
                  {drawOffer.playerName} offered a draw
                </span>
              </div>

              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={acceptDraw}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                >
                  <Check className="w-4 h-4 mr-2" />
                  Accept
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={declineDraw}
                  className="flex-1"
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Decline
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="pt-3 border-t border-white/10"
        >
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-300 group"
            onClick={handleLeaveGame}
          >
            <LogOut className="w-4 h-4 mr-2 group-hover:translate-x-1 transition-transform duration-300" />
            Leave Game
          </Button>
        </motion.div>
      </CardContent>
    </Card>
  );
};

export default memo(GameControls);
