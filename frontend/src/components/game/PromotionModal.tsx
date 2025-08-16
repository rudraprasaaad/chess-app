import { AnimatePresence, motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Crown } from "lucide-react";
import { memo } from "react";

const PROMOTION_PIECES = ["q", "r", "b", "n"] as const;

interface PromotionModalProps {
  isOpen: boolean;
  onSelectPromotion: (piece: "q" | "r" | "b" | "n") => void;
  onCancel: () => void;
}

const piecesNames: Record<string, string> = {
  q: "Queen",
  r: "Rook",
  b: "Bishop",
  n: "Knight",
};

const pieceSymbols = {
  white: { q: "♕", r: "♖", b: "♗", n: "♘" },
  black: { q: "♛", r: "♜", b: "♝", n: "♞" },
};

const PromotionModal = ({
  isOpen,
  onSelectPromotion,
  onCancel,
}: PromotionModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          />

          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ scale: 0.8, opacity: 0, y: 50 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.8, opacity: 0, y: 50 }}
            transition={{
              type: "spring",
              stiffness: 300,
              damping: 25,
              duration: 0.5,
            }}
            role="dialog"
            aria-modal="true"
            aria-label="Choose Promotion piece"
          >
            <Card className="w-full max-w-sm glass border-white/10 overflow-hidden">
              <motion.div
                className="absolute inset-0 bg-chess-gold/5 opacity-50"
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
                <CardHeader className="text-center space-y-3">
                  <motion.div
                    className="flex justify-center text-chess-gold"
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      delay: 0.4,
                      type: "spring",
                      stiffness: 200,
                      damping: 15,
                    }}
                  >
                    <Crown className="w-8 h-8" />
                  </motion.div>

                  <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.5, duration: 0.4 }}
                  >
                    <CardTitle className="text-xl">Promote Pawn</CardTitle>
                    <p className="text-muted-foreground text-sm mt-2">
                      Choose a piece to promote to:
                    </p>
                  </motion.div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <motion.div
                    className="grid grid-cols-2 gap-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.6, duration: 0.4 }}
                  >
                    {PROMOTION_PIECES.map((piece, index) => (
                      <motion.div
                        key={piece}
                        initial={{ scale: 0, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        transition={{
                          delay: 0.7 + index * 0.1,
                          type: "spring",
                          stiffness: 300,
                          damping: 20,
                        }}
                      >
                        <Button
                          onClick={() => onSelectPromotion(piece)}
                          aria-label={`Promote to ${piecesNames[piece]}`}
                          variant="outline"
                          className="w-full h-20 flex flex-col items-center justify-center space-y-2 hover:bg-primary/10 hover:border-primary/30 hover:scale-105 transition-all duration-300 group"
                        >
                          <motion.span
                            className="text-4xl select-none group-hover:scale-110 transition-transform duration-200"
                            whileHover={{ rotate: [0, -10, 10, 0] }}
                            transition={{ duration: 0.5 }}
                          >
                            {pieceSymbols.white[piece]}
                          </motion.span>
                          <span className="text-xs font-medium text-muted-foreground group-hover:text-primary transition-colors duration-200">
                            {piecesNames[piece]}
                          </span>
                        </Button>
                      </motion.div>
                    ))}
                  </motion.div>

                  <motion.div
                    className="flex justify-center pt-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.1, duration: 0.4 }}
                  >
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={onCancel}
                      className="hover:bg-muted/50 transition-all duration-200"
                    >
                      Cancel
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

export default memo(PromotionModal);
