import { motion } from "framer-motion";

export const Footer = () => {
  return (
    <motion.footer
      className="relative border-t border-border/30 py-16 mt-32"
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 2 }}
    >
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <motion.div
            className="flex items-center gap-4"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <div className="w-8 h-8 bg-foreground rounded-full flex items-center justify-center">
              <span className="text-base text-background">♔</span>
            </div>
            <span className="font-heading font-light text-foreground tracking-wide">
              Chess
            </span>
          </motion.div>

          <p className="text-muted-foreground/60 text-sm font-light tracking-wide">
            © 2025 Chess. Crafted with care.
          </p>
        </div>
      </div>
    </motion.footer>
  );
};
