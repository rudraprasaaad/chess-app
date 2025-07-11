import { motion } from "framer-motion";

const chessPieces = [
  { symbol: "♔", x: "15%", y: "20%", delay: 0, scale: 1.2 },
  { symbol: "♕", x: "80%", y: "15%", delay: 1.5, scale: 1.5 },
  { symbol: "♖", x: "20%", y: "70%", delay: 3, scale: 1.1 },
  { symbol: "♗", x: "75%", y: "65%", delay: 2, scale: 1.3 },
  { symbol: "♘", x: "10%", y: "50%", delay: 4, scale: 1.4 },
  { symbol: "♙", x: "85%", y: "80%", delay: 0.5, scale: 0.9 },
];

export const FloatingChessPieces = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {chessPieces.map((piece, index) => (
        <motion.div
          key={index}
          className="absolute text-4xl md:text-6xl lg:text-7xl text-primary/20 select-none"
          style={{ left: piece.x, top: piece.y }}
          initial={{
            opacity: 0,
            scale: 0.5,
            rotate: -30,
          }}
          animate={{
            opacity: [0.2, 0.4, 0.2],
            scale: [piece.scale * 0.8, piece.scale, piece.scale * 0.8],
            rotate: [0, 15, -15, 0],
            y: [-20, 20, -20],
          }}
          transition={{
            delay: piece.delay,
            duration: 8 + Math.random() * 4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          {piece.symbol}
        </motion.div>
      ))}
    </div>
  );
};
