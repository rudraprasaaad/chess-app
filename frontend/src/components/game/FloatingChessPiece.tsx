import { motion } from "framer-motion";
import { memo } from "react";

const floatingAnimation = {
  y: [-20, 20, -20],
  rotate: [-2, 2, -2],
  transition: {
    duration: 6,
    repeat: Infinity,
    ease: "easeInOut" as const,
  },
};

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

const FloatingChessPiece = ({
  piece,
  className,
  delay = 0,
}: {
  piece: string;
  className: string;
  delay?: number;
}) => {
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

export default memo(FloatingChessPiece);
