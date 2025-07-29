import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { ScrollText, Clock, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";

interface Move {
  moveNumber: number;
  white?: string;
  black?: string;
  timestamp?: number;
}

interface MoveHistoryProps {
  moves: Move[];
}

const MoveHistory = ({ moves = [] }: MoveHistoryProps) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new moves are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [moves]);

  const formatTime = (timestamp?: number) => {
    if (!timestamp) return "";
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Convert flat move array to paired moves for display
  const pairedMoves = moves.reduce((acc: Move[], move, index) => {
    const moveNumber = Math.floor(index / 2) + 1;
    const isWhite = index % 2 === 0;

    if (isWhite) {
      acc.push({
        moveNumber,
        white: move.white || move.toString(), // Handle different move formats
        timestamp: move.timestamp,
      });
    } else {
      const lastMove = acc[acc.length - 1];
      if (lastMove && lastMove.moveNumber === moveNumber) {
        lastMove.black = move.black || move.toString();
      }
    }

    return acc;
  }, []);

  return (
    <Card className="glass border-white/10 h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center text-lg">
          <ScrollText className="w-5 h-5 mr-2 text-chess-silver" />
          Move History
        </CardTitle>
      </CardHeader>

      <CardContent className="p-0">
        <div
          ref={scrollRef}
          className="space-y-1 max-h-96 overflow-y-auto px-4 pb-4 scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent"
        >
          {pairedMoves.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center text-muted-foreground py-8"
            >
              <ScrollText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="font-heading font-medium">No moves yet</p>
              <p className="text-sm mt-1 opacity-75">
                Moves will appear here as the game progresses
              </p>
            </motion.div>
          ) : (
            pairedMoves.map((move, index) => (
              <motion.div
                key={move.moveNumber}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05, ease: "easeOut" }}
                className="group relative"
              >
                <div className="flex items-center py-3 px-3 rounded-lg hover:bg-white/5 transition-all duration-300 group-hover:shadow-sm">
                  {/* Move Number */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/50 text-sm font-bold text-muted-foreground mr-3 group-hover:bg-primary/20 group-hover:text-primary transition-colors duration-300">
                    {move.moveNumber}
                  </div>

                  {/* Moves Container */}
                  <div className="flex-1 flex items-center space-x-3">
                    {/* White's Move */}
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <div className="w-3 h-3 bg-white rounded-full border border-gray-300 shadow-sm" />
                        <span className="text-sm font-mono bg-white/10 px-3 py-1 rounded-md border border-white/20 font-medium">
                          {move.white || "—"}
                        </span>
                      </div>
                    </div>

                    {/* Arrow */}
                    {move.black && (
                      <ChevronRight className="w-3 h-3 text-muted-foreground opacity-50" />
                    )}

                    {/* Black's Move */}
                    <div className="flex-1">
                      {move.black && (
                        <div className="flex items-center space-x-2">
                          <div className="w-3 h-3 bg-gray-800 rounded-full border border-gray-600 shadow-sm" />
                          <span className="text-sm font-mono bg-gray-800/20 px-3 py-1 rounded-md border border-gray-600/30 font-medium">
                            {move.black}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Timestamp */}
                  {move.timestamp && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="ml-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    >
                      <span className="text-xs text-muted-foreground flex items-center bg-muted/50 px-2 py-1 rounded">
                        <Clock className="w-3 h-3 mr-1" />
                        {formatTime(move.timestamp)}
                      </span>
                    </motion.div>
                  )}
                </div>

                {/* Subtle divider */}
                {index < pairedMoves.length - 1 && (
                  <div className="absolute bottom-0 left-12 right-4 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                )}
              </motion.div>
            ))
          )}
        </div>

        {/* Footer with move count */}
        {moves.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="px-4 pb-4 pt-3 border-t border-white/10"
          >
            <div className="text-center">
              <span className="text-xs text-muted-foreground bg-muted/50 px-3 py-1 rounded-full">
                {moves.length} move{moves.length !== 1 ? "s" : ""} played
              </span>
            </div>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
};

export default MoveHistory;
