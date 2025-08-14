import React, {
  ChangeEvent,
  useEffect,
  useRef,
  useState,
  useCallback,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useGameChat } from "../../store/game";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { MessageCircle, Send } from "lucide-react";

const GameChat = () => {
  const { messages, sendMessage, typingUsers, startTyping, stopTyping } =
    useGameChat();

  const [input, setInput] = useState("");
  const messageRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    messageRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const debouncedStopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping();
    }, 1000);
  }, [stopTyping]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    if (value.length > 0) {
      startTyping();
      debouncedStopTyping();
    } else {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      stopTyping();
    }
  };

  const handleSend = () => {
    if (input.trim() === "") return;
    sendMessage(input);
    setInput("");

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    stopTyping();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, []);

  const typingUsersDisplay =
    typingUsers.length > 0
      ? `${typingUsers.length} player${
          typingUsers.length > 1 ? "s" : ""
        } typing...`
      : "";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5, duration: 0.6 }}
      className="h-full flex flex-col"
    >
      <Card className="glass border-white/10 h-full flex flex-col overflow-hidden">
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="flex items-center text-lg">
            <MessageCircle className="w-5 h-5 mr-2 text-primary" />
            Chat
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0 px-6 pb-6 flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Messages */}
          <div className="flex-1 overflow-y-auto mb-3 pr-2 chat-scroll min-h-0">
            <div className="space-y-2">
              <AnimatePresence>
                {messages.map((msg, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ duration: 0.3 }}
                    className="p-2 bg-muted/50 rounded-lg text-sm break-words"
                  >
                    {msg.text}
                  </motion.div>
                ))}
              </AnimatePresence>
              <div ref={messageRef} />
            </div>
          </div>

          {/* Typing Indicator */}
          <AnimatePresence>
            {typingUsersDisplay && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="text-xs text-muted-foreground italic mb-2 px-2 flex-shrink-0"
              >
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {typingUsersDisplay}
                </motion.span>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="flex gap-2 items-center flex-shrink-0">
            <Input
              type="text"
              className="flex-1 bg-background/50 border-white/10 focus:border-primary/50 transition-colors"
              placeholder="Type a message..."
              value={input}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              autoComplete="off"
            />
            <Button
              onClick={handleSend}
              size="sm"
              className="shrink-0 bg-primary hover:bg-primary/90 transition-colors"
              disabled={!input.trim()}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export default GameChat;
