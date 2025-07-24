import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "../components/ui/button";
import { FloatingChessPieces } from "./FloatingChessPieces";
import { LoginModal } from "./auth/LoginModal";

export const HeroSection = () => {
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 60, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring" as const,
        stiffness: 100,
        damping: 20,
      },
    },
  };

  return (
    <>
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-background grain">
        {/* Animated Background */}
        <div className="absolute inset-0 chess-pattern opacity-[0.02]" />

        {/* Gradient Overlays */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />

        {/* Floating Chess Pieces */}
        <FloatingChessPieces />

        {/* Hero Content */}
        <motion.div
          className="relative z-10 max-w-6xl mx-auto px-6 text-center"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          {/* Badge */}
          <motion.div
            variants={itemVariants}
            className="inline-flex items-center gap-3 glass rounded-full px-6 py-3 mb-12 border-primary/20"
          >
            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
            <span className="text-sm font-light text-muted-foreground tracking-wide">
              Live multiplayer chess reimagined
            </span>
          </motion.div>

          {/* Main Heading */}
          <motion.h1
            variants={itemVariants}
            className="text-6xl md:text-8xl lg:text-9xl font-display font-light leading-[0.85] mb-8 tracking-tight"
          >
            Play Chess.
            <br />
            <span className="gradient-text block font-extralight italic">
              Beautifully.
            </span>
          </motion.h1>

          {/* Subheading */}
          <motion.p
            variants={itemVariants}
            className="text-lg md:text-xl text-muted-foreground/80 max-w-2xl mx-auto mb-12 leading-relaxed font-light tracking-wide"
          >
            Experience chess in its purest form with{" "}
            <span className="text-foreground/90 font-normal">
              real-time gameplay
            </span>
            , intelligent matchmaking, and timeless design.
          </motion.p>

          {/* Stats */}
          <motion.div
            variants={itemVariants}
            className="flex items-center justify-center gap-12 mb-16 text-xs text-muted-foreground/60 font-light tracking-widest uppercase"
          >
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-primary/70 rounded-full" />
              <span>Real-time</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-accent/70 rounded-full" />
              <span>Global</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 bg-primary/70 rounded-full" />
              <span>Cross-platform</span>
            </div>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            variants={itemVariants}
            className="flex flex-col sm:flex-row gap-6 justify-center items-center"
          >
            <Button
              size="lg"
              className="bg-foreground text-background hover:bg-foreground/90 px-12 py-8 text-base font-light rounded-full shadow-2xl border-0 min-w-[240px] transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] tracking-wide"
              onClick={() => setIsLoginModalOpen(true)}
            >
              Start Playing
            </Button>

            <Button
              variant="outline"
              size="lg"
              className="glass border-border/30 hover:bg-muted/10 hover:border-border/50 px-12 py-8 text-base font-light rounded-full min-w-[240px] transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] tracking-wide"
              onClick={() => setIsLoginModalOpen(true)}
            >
              Quick Match
            </Button>
          </motion.div>

          {/* Floating Action Hint */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2, duration: 1 }}
            className="mt-24 text-xs text-muted-foreground/40 font-light tracking-widest uppercase"
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              Scroll to explore
            </motion.div>
          </motion.div>
        </motion.div>

        {/* Ambient Glow */}
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-slow" />
        <div
          className="absolute bottom-1/3 right-1/4 w-80 h-80 bg-accent/5 rounded-full blur-3xl animate-pulse-slow"
          style={{ animationDelay: "3s" }}
        />
      </section>

      <LoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />
    </>
  );
};
