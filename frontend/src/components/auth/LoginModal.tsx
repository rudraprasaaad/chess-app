import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { useGoogleLogin, useGuestLogin } from "../../hooks/api/useAuth";
import { toast } from "sonner";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal = ({ isOpen, onClose }: LoginModalProps) => {
  const [guestName, setGuestName] = useState("");
  const [showGuestInput, setShowGuestInput] = useState(false);

  const guestLoginMutation = useGuestLogin();
  const googleLoginMutation = useGoogleLogin();

  const isLoading =
    guestLoginMutation.isPending || googleLoginMutation.isPending;

  const handleGuestLogin = () => {
    if (!guestName.trim()) {
      toast.error("Please enter a valid name");
      return;
    }

    guestLoginMutation.mutate(
      { name: guestName.trim() },
      {
        onSuccess: () => {
          toast.success(`Welcome, ${guestName.trim()}!`);
          setGuestName("");
          setShowGuestInput(false);
          onClose();
        },
      }
    );
  };

  const handleGoogleLogin = () => {
    googleLoginMutation.mutate();
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && guestName.trim() && !isLoading) {
      handleGuestLogin();
    }
  };

  const handleBackToOptions = () => {
    setShowGuestInput(false);
    setGuestName("");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-background/60 backdrop-blur-lg z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <Card className="glass-intense glow-primary w-full max-w-sm relative overflow-hidden rounded-3xl">
              {/* Grain texture */}
              <div className="grain absolute inset-0" />

              {/* Loading Overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-background/50 backdrop-blur-sm flex items-center justify-center z-20 rounded-3xl">
                  <Loader2 className="w-8 h-8 animate-spin text-foreground" />
                </div>
              )}

              {/* Close button */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-6 right-6 z-10 hover:bg-muted/10 rounded-full"
                onClick={onClose}
                disabled={isLoading}
              >
                <X className="w-4 h-4" />
              </Button>

              <CardHeader className="text-center space-y-6 pb-8">
                {/* Chess icon */}
                <motion.div
                  className="mx-auto w-16 h-16 bg-foreground rounded-full flex items-center justify-center glow-chess"
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <span className="text-2xl text-background">♔</span>
                </motion.div>

                <motion.div
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.3 }}
                >
                  <CardTitle className="text-2xl font-display font-light tracking-tight">
                    Welcome
                  </CardTitle>
                  <CardDescription className="text-muted-foreground/70 font-light tracking-wide">
                    {showGuestInput
                      ? "Enter your name to continue"
                      : "Choose your way to begin"}
                  </CardDescription>
                </motion.div>
              </CardHeader>

              <CardContent className="space-y-4 px-8 pb-8">
                {!showGuestInput ? (
                  <>
                    {/* Google Login */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.4 }}
                    >
                      <Button
                        className="w-full bg-foreground text-background hover:bg-foreground/90 font-light h-14 rounded-full transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] tracking-wide"
                        size="lg"
                        onClick={handleGoogleLogin}
                        disabled={isLoading}
                      >
                        <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                          <path
                            fill="currentColor"
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                          />
                          <path
                            fill="currentColor"
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                          />
                          <path
                            fill="currentColor"
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                          />
                        </svg>
                        Continue with Google
                      </Button>
                    </motion.div>

                    {/* Guest Login Button */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.5 }}
                    >
                      <Button
                        variant="outline"
                        className="w-full border-border/30 hover:bg-muted/5 hover:border-border/50 h-14 rounded-full font-light transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] tracking-wide"
                        size="lg"
                        onClick={() => setShowGuestInput(true)}
                        disabled={isLoading}
                      >
                        <span className="text-xl mr-3">♟</span>
                        Continue as Guest
                      </Button>
                    </motion.div>
                  </>
                ) : (
                  <>
                    {/* Guest Name Input */}
                    <motion.div
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="space-y-4"
                    >
                      <Input
                        placeholder="Enter your name"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        className="h-14 rounded-full glass border-border/30 px-6 text-center font-light tracking-wide focus:ring-2 focus:ring-primary/20 focus:border-primary/30"
                        onKeyDown={handleKeyPress}
                        disabled={isLoading}
                        autoFocus
                        maxLength={30}
                      />

                      <div className="flex gap-3">
                        <Button
                          variant="outline"
                          className="flex-1 h-12 rounded-full border-border/30 hover:bg-muted/5 font-light"
                          onClick={handleBackToOptions}
                          disabled={isLoading}
                        >
                          Back
                        </Button>
                        <Button
                          className="flex-1 h-12 rounded-full bg-foreground text-background hover:bg-foreground/90 font-light"
                          onClick={handleGuestLogin}
                          disabled={!guestName.trim() || isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Joining...
                            </>
                          ) : (
                            "Start Playing"
                          )}
                        </Button>
                      </div>
                    </motion.div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
